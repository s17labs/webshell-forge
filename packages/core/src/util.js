const RESERVED = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null',
]);

export function slugify(name) {
  const slug = String(name || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('')
    .slice(0, 30);
  if (!slug) return 'app';
  if (/^[0-9]/.test(slug)) return `a${slug}`;
  return slug;
}

export function derivePackageId(name) {
  return `com.webshellforge.${slugify(name)}`;
}

export function isValidPackageId(id) {
  if (typeof id !== 'string') return false;
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(id)) return false;
  for (const seg of id.split('.')) {
    if (RESERVED.has(seg)) return false;
  }
  return true;
}

export function apkSlug(name) {
  const slug = String(name || '')
    .toLowerCase()
    .trim()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'app';
}

export function escapeAndroidString(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeXmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function assertNonEmpty(value, field) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) {
    throw new Error(`Field "${field}" is required and cannot be empty.`);
  }
  return v;
}

export function normalizeVersionName(v) {
  const s = String(v ?? '').trim();
  if (!/^[0-9]+(\.[0-9]+){0,2}([-+._a-zA-Z0-9]*)?$/.test(s)) {
    throw new Error(`Invalid versionName "${s}" — expected something like "1.0.0".`);
  }
  return s;
}
