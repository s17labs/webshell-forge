import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const forge = await import('../packages/core/src/index.js');

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

const SAMPLE = {
  html: '<html><head><title>t</title></head><body><p>hi</p></body></html>',
  css: 'body{margin:0}',
  js: 'console.log("ok")',
};

test('template is vendored and pinned', () => {
  const sha = forge.templateVersion();
  assert.match(sha, /^[0-9a-f]{40}$/, `expected pinned SHA, got "${sha}"`);
  assert.ok(fs.existsSync(path.join(forge.TEMPLATE_DIR, 'gradlew')));
});

test('createApp stamps identity into gradle + strings', async () => {
  const out = path.join(tmpDir('forge-basic'), 'proj');
  const r = await forge.createApp({
    name: "Sam's Demo App",
    description: 'desc here',
    ...SAMPLE,
    outputDir: out,
  });

  assert.equal(r.packageName, 'com.webshellforge.samsdemoapp');
  assert.equal(r.apkFileName, 'sam-s-demo-app-v1.0.0-debug.apk');

  const gradle = fs.readFileSync(path.join(out, 'app/build.gradle.kts'), 'utf8');
  assert.match(gradle, /applicationId = "com\.webshellforge\.samsdemoapp"/);
  assert.match(gradle, /versionCode = 1/);
  assert.match(gradle, /versionName = "1\.0\.0"/);
  assert.match(gradle, /namespace = "com\.yourapp"/);

  const strings = fs.readFileSync(path.join(out, 'app/src/main/res/values/strings.xml'), 'utf8');
  assert.match(strings, new RegExp(String.raw`<string name="app_name">Sam\\'s Demo App</string>`));

  const appJson = JSON.parse(fs.readFileSync(path.join(out, 'app/src/main/assets/www/app.json'), 'utf8'));
  assert.equal(appJson.description, 'desc here');
});

test('bridge.js is injected when missing and preserved when present', async () => {
  const base = tmpDir('forge-bridge');

  const withoutBridge = path.join(base, 'a');
  await forge.createApp({ name: 'A', html: '<html><body>x</body></html>', outputDir: withoutBridge });
  const htmlA = fs.readFileSync(path.join(withoutBridge, 'app/src/main/assets/www/index.html'), 'utf8');
  assert.match(htmlA, /<script src="bridge\.js"><\/script>/);

  const withBridge = path.join(base, 'b');
  await forge.createApp({
    name: 'B',
    html: '<html><head><script src="bridge.js"></script></head><body></body></html>',
    outputDir: withBridge,
  });
  const htmlB = fs.readFileSync(path.join(withBridge, 'app/src/main/assets/www/index.html'), 'utf8');
  assert.equal(htmlB.match(/<script src="bridge\.js"><\/script>/g).length, 1);
});

test('custom icon generates adaptive icons and removes placeholders', async () => {
  const sharp = (await import('sharp')).default;
  const base = tmpDir('forge-icon');
  const pngPath = path.join(base, 'icon.png');
  await sharp({ create: { width: 300, height: 200, channels: 4, background: '#00aa55' } }).png().toFile(pngPath);

  const out = path.join(base, 'proj');
  const r = await forge.createApp({
    name: 'Icon App',
    html: SAMPLE.html,
    outputDir: out,
    iconPath: pngPath,
    iconBackgroundColor: '#abcdef',
  });
  assert.equal(r.iconApplied, true);

  const res = path.join(out, 'app/src/main/res');
  for (const dpi of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    assert.ok(fs.existsSync(path.join(res, `mipmap-${dpi}/ic_launcher_foreground.png`)), `missing ${dpi} foreground`);
    assert.ok(!fs.existsSync(path.join(res, `mipmap-${dpi}/ic_launcher.xml`)), `placeholder not removed in ${dpi}`);
  }
  const adaptive = fs.readFileSync(path.join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), 'utf8');
  assert.match(adaptive, /<foreground android:drawable="@mipmap\/ic_launcher_foreground"\/>/);
  const colors = fs.readFileSync(path.join(res, 'values/ic_launcher_background.xml'), 'utf8');
  assert.match(colors, /#abcdef/);
});

test('invalid inputs are rejected cleanly', async () => {
  const base = tmpDir('forge-invalid');
  await assert.rejects(
    () => forge.createApp({ name: '', html: 'x', outputDir: path.join(base, 'a') }),
    /name/i,
  );
  await assert.rejects(
    () => forge.createApp({ name: 'X', html: 'x', packageName: 'Bad Pkg!', outputDir: path.join(base, 'b') }),
    /Invalid applicationId/,
  );
  await assert.rejects(
    () => forge.createApp({ name: 'X', html: '', outputDir: path.join(base, 'c') }),
    /HTML content is required/,
  );
  await assert.rejects(
    () => forge.createApp({ name: 'X', html: 'x', versionName: 'abc', outputDir: path.join(base, 'd') }),
    /versionName/,
  );
});

test('failed scaffold cleans up its directory', async () => {
  const base = tmpDir('forge-cleanup');
  const out = path.join(base, 'proj');
  await assert.rejects(() => forge.createApp({ name: 'X', html: '', outputDir: out }));
  assert.ok(!fs.existsSync(out), 'staging dir should be removed on failure');
});

test('exportRepo produces a clean CI-ready repo', async () => {
  const base = tmpDir('forge-export');
  const staged = path.join(base, 'staged');
  await forge.createApp({
    name: 'Export App',
    description: 'exported to CI',
    ...SAMPLE,
    outputDir: staged,
  });
  // simulate build artifacts that must not leak into the export
  fs.mkdirSync(path.join(staged, 'app/build/outputs/apk/debug'), { recursive: true });
  fs.writeFileSync(path.join(staged, 'app/build/outputs/apk/debug/app-debug.apk'), 'fake');
  fs.writeFileSync(path.join(staged, '.forge-meta.json'), '{}');

  const out = path.join(base, 'export-app-android');
  const r = forge.exportRepo({
    sourceDir: staged,
    outDir: out,
    appName: 'Export App',
    description: 'exported to CI',
    packageName: 'com.webshellforge.exportapp',
    versionName: '1.0.0',
  });

  assert.equal(r.outDir, out);
  assert.ok(fs.existsSync(path.join(out, '.github/workflows/build.yml')));
  const workflow = fs.readFileSync(path.join(out, '.github/workflows/build.yml'), 'utf8');
  assert.match(workflow, /gradlew assembleDebug/);
  assert.match(workflow, /upload-artifact/);
  assert.ok(fs.existsSync(path.join(out, 'app/src/main/assets/www/index.html')));
  assert.equal(fs.existsSync(path.join(out, 'app/build')), false, 'build dir must be excluded');
  assert.equal(fs.existsSync(path.join(out, '.forge-meta.json')), false, 'meta must be excluded');
  assert.match(fs.readFileSync(path.join(out, 'README.md'), 'utf8'), /# Export App/);
  const mode = fs.statSync(path.join(out, 'gradlew')).mode & 0o111;
  assert.ok(mode, 'gradlew must stay executable');

  assert.throws(
    () => forge.exportRepo({ sourceDir: base, outDir: path.join(base, 'nope') }),
    /Not a WebShell Forge project/,
  );
});

test('zipDirectory round-trips through readZipEntries', async () => {
  const base = tmpDir('forge-zip-src');
  fs.mkdirSync(path.join(base, 'nested/deep'), { recursive: true });
  fs.writeFileSync(path.join(base, 'a.txt'), 'hello zip');
  fs.writeFileSync(path.join(base, 'nested/b.txt'), 'x'.repeat(5000));
  fs.writeFileSync(path.join(base, 'nested/deep/c.bin'), Buffer.from([0, 1, 2, 255, 254, 0]));

  const zipBuf = forge.zipDirectory(base);
  const entries = forge.readZipEntries(zipBuf);
  const byName = Object.fromEntries(entries.map((e) => [e.name, e.data]));

  assert.deepEqual(
    entries.map((e) => e.name).sort(),
    ['a.txt', 'nested/b.txt', 'nested/deep/c.bin'],
  );
  assert.equal(byName['a.txt'].toString(), 'hello zip');
  assert.equal(byName['nested/b.txt'].length, 5000);
  assert.deepEqual([...byName['nested/deep/c.bin']], [0, 1, 2, 255, 254, 0]);
});
