import fs from 'node:fs';
import path from 'node:path';
import { TEMPLATE_DIR } from './paths.js';

export function scaffoldTemplate(outputDir) {
  if (!outputDir || typeof outputDir !== 'string') {
    throw new Error('scaffoldTemplate requires an outputDir');
  }
  const target = path.resolve(outputDir);
  if (fs.existsSync(target)) {
    throw new Error(`Output directory already exists: ${target}`);
  }
  fs.mkdirSync(target, { recursive: true });
  copyRecursive(TEMPLATE_DIR, target);
  return target;
}

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
      const mode = fs.statSync(s).mode;
      fs.chmodSync(d, mode);
    }
  }
}
