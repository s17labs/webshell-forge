import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp, buildApp, copyApk } from '@s17labs/forge-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const projectsDir = path.join(root, 'projects');
const distDir = path.join(root, 'dist');
fs.mkdirSync(projectsDir, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });

const app = express();
app.use(express.json({ limit: '30mb' }));
app.use(express.static(path.join(here, 'public')));

const building = new Set();

function projectPath(id) {
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error('Invalid project id.');
  return path.join(projectsDir, id);
}

function readMeta(id) {
  return JSON.parse(fs.readFileSync(path.join(projectPath(id), '.forge-meta.json'), 'utf8'));
}

app.post('/api/projects', async (req, res) => {
  try {
    const b = req.body || {};
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    let iconPath;
    let tmpIcon;
    if (b.iconDataUrl) {
      const m = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,(.+)$/s.exec(b.iconDataUrl);
      if (!m) return res.status(400).json({ error: 'Icon must be a base64 data URL (png/jpeg/webp/svg).' });
      const extMap = { png: 'png', jpeg: 'jpg', jpg: 'jpg', webp: 'webp', 'svg+xml': 'svg' };
      tmpIcon = path.join(os.tmpdir(), `forge-icon-${id}.${extMap[m[1]]}`);
      fs.writeFileSync(tmpIcon, Buffer.from(m[2], 'base64'));
      iconPath = tmpIcon;
    }

    const result = await createApp({
      name: b.name,
      description: b.description,
      packageName: b.packageName,
      versionName: b.versionName,
      versionCode: b.versionCode,
      html: b.html,
      css: b.css,
      js: b.js,
      outputDir: path.join(projectsDir, id),
      iconPath,
      iconBackgroundColor: b.iconBackgroundColor,
    });

    fs.writeFileSync(
      path.join(result.projectDir, '.forge-meta.json'),
      JSON.stringify({ id, ...result, createdAt: new Date().toISOString() }, null, 2),
    );
    if (tmpIcon) fs.rmSync(tmpIcon, { force: true });

    res.json({
      id,
      packageName: result.packageName,
      versionName: result.versionName,
      apkFileName: result.apkFileName,
      iconApplied: result.iconApplied,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/build/:id', (req, res) => {
  const id = req.params.id;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  if (building.has(id)) {
    send('error', { error: 'A build is already running for this project.' });
    return res.end();
  }
  building.add(id);

  const meta = (() => {
    try {
      return readMeta(id);
    } catch {
      return null;
    }
  })();
  if (!meta) {
    building.delete(id);
    send('error', { error: 'Project not found.' });
    return res.end();
  }

  send('log', { line: `Building ${meta.packageName} v${meta.versionName} (debug)...` });
  buildApp(projectPath(id), {
    onLog: (line) => send('log', { line }),
  })
    .then(({ apkPath }) => {
      const dest = path.join(distDir, meta.apkFileName);
      copyApk(apkPath, dest);
      send('done', { apkUrl: `/api/apk/${encodeURIComponent(id)}`, fileName: meta.apkFileName });
    })
    .catch((err) => send('error', { error: err.message }))
    .finally(() => {
      building.delete(id);
      res.end();
    });

  req.on('close', () => {});
});

app.get('/api/apk/:id', (req, res) => {
  try {
    const meta = readMeta(req.params.id);
    const src = path.join(distDir, meta.apkFileName);
    if (!fs.existsSync(src)) return res.status(404).json({ error: 'APK not built yet.' });
    res.download(src, meta.apkFileName);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT || 4321);
app.listen(port, () => {
  console.log(`\n  WebShell Forge dashboard → http://localhost:${port}\n`);
});
