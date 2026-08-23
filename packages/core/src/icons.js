import fs from 'node:fs';
import path from 'node:path';
import { escapeXmlAttr } from './util.js';

const DENSITIES = [
  ['mdpi', 108],
  ['hdpi', 162],
  ['xhdpi', 216],
  ['xxhdpi', 324],
  ['xxxhdpi', 432],
];

const SAFE_ZONE = 0.66;

export async function stampIcon(projectDir, iconPath, backgroundColor = '#6200EE') {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (err) {
    throw new Error(`sharp is unavailable (${err.message}); cannot process custom icons.`);
  }

  if (!fs.existsSync(iconPath)) {
    throw new Error(`Icon file not found: ${iconPath}`);
  }

  const normalized = await normalizeToSquarePng(sharp, iconPath);

  const resDir = path.join(projectDir, 'app', 'src', 'main', 'res');
  removePlaceholderIcons(resDir);

  for (const [dpi, canvas] of DENSITIES) {
    const outDir = path.join(resDir, `mipmap-${dpi}`);
    fs.mkdirSync(outDir, { recursive: true });
    const inner = Math.round(canvas * SAFE_ZONE);
    const pad = Math.max(0, Math.floor((canvas - inner) / 2));
    await sharp(normalized)
      .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: TRANSPARENT })
      .png()
      .toFile(path.join(outDir, 'ic_launcher_foreground.png'));
  }

  writeAdaptiveIconXml(resDir);
  writeBackgroundColor(resDir, backgroundColor);

  return true;
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function normalizeToSquarePng(sharp, iconPath) {
  const base = sharp(iconPath);
  const meta = await base.metadata();
  let pipeline = base;
  if ((meta.format || '').toLowerCase() === 'svg' || /\.svg$/i.test(iconPath)) {
    const rendered = await sharp(iconPath, { density: 512 })
      .resize(1024, 1024, { fit: 'contain', background: TRANSPARENT })
      .png()
      .toBuffer();
    return rendered;
  }
  pipeline = sharp(iconPath).rotate();
  return pipeline
    .resize(1024, 1024, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
}

function removePlaceholderIcons(resDir) {
  for (const entry of fs.readdirSync(resDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('mipmap-')) continue;
    const dir = path.join(resDir, entry.name);
    if (entry.name === 'mipmap-anydpi-v26') continue;
    for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) fs.rmSync(p);
    }
  }
}

function writeAdaptiveIconXml(resDir) {
  const dir = path.join(resDir, 'mipmap-anydpi-v26');
  fs.mkdirSync(dir, { recursive: true });
  const xml =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n' +
    '    <background android:drawable="@color/ic_launcher_background"/>\n' +
    '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n' +
    '    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>\n' +
    '</adaptive-icon>\n';
  fs.writeFileSync(path.join(dir, 'ic_launcher.xml'), xml);
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.xml'), xml);
}

function writeBackgroundColor(resDir, color) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#6200EE';
  const valuesDir = path.join(resDir, 'values');
  fs.mkdirSync(valuesDir, { recursive: true });
  const xml =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<resources>\n' +
    `    <color name="ic_launcher_background">${escapeXmlAttr(hex)}</color>\n` +
    '</resources>\n';
  fs.writeFileSync(path.join(valuesDir, 'ic_launcher_background.xml'), xml);
}
