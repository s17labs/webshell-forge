import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const TEMPLATE_DIR = path.resolve(here, '../../../templates/webshell');
export const TEMPLATE_VERSION_FILE = path.resolve(here, '../../../templates/.template-version');

export function templateVersion() {
  try {
    const text = fs.readFileSync(TEMPLATE_VERSION_FILE, 'utf8');
    const line = text.split('\n').find((l) => l.startsWith('commit:'));
    return line ? line.slice('commit:'.length).trim() : 'unknown';
  } catch {
    return 'unknown';
  }
}
