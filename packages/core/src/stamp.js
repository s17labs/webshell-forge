import fs from 'node:fs';
import path from 'node:path';
import { assertNonEmpty, escapeAndroidString, isValidPackageId, normalizeVersionName } from './util.js';

const GRADLE_REL = path.join('app', 'build.gradle.kts');
const STRINGS_REL = path.join('app', 'src', 'main', 'res', 'values', 'strings.xml');

export function stampProject(projectDir, options = {}) {
  const pkg = String(options.packageName || '').trim();
  if (!isValidPackageId(pkg)) {
    throw new Error(`Invalid applicationId "${pkg}" — expected e.g. com.example.myapp`);
  }
  const appName = assertNonEmpty(options.name, 'name');
  const vName = normalizeVersionName(options.versionName ?? '1.0.0');
  const vCode = Number.parseInt(options.versionCode ?? 1, 10);
  if (!Number.isInteger(vCode) || vCode < 1 || vCode > 2100000000) {
    throw new Error(`Invalid versionCode "${options.versionCode}" — expected an integer >= 1.`);
  }

  stampGradle(projectDir, { pkg, vCode, vName });
  stampStrings(projectDir, { appName });
}

function stampGradle(projectDir, { pkg, vCode, vName }) {
  const file = path.join(projectDir, GRADLE_REL);
  let text = fs.readFileSync(file, 'utf8');
  text = replaceOnce(text, /applicationId\s*=\s*"[^"]+"/, `applicationId = "${pkg}"`, file);
  text = replaceOnce(text, /versionCode\s*=\s*\d+/, `versionCode = ${vCode}`, file);
  text = replaceOnce(text, /versionName\s*=\s*"[^"]*"/, `versionName = "${vName}"`, file);
  fs.writeFileSync(file, text);
}

function stampStrings(projectDir, { appName }) {
  const file = path.join(projectDir, STRINGS_REL);
  let text = fs.readFileSync(file, 'utf8');
  const escaped = escapeAndroidString(appName);
  text = replaceOnce(
    text,
    /<string name="app_name">[^<]*<\/string>/,
    `<string name="app_name">${escaped}</string>`,
    file,
  );
  fs.writeFileSync(file, text);
}

function replaceOnce(text, pattern, replacement, file) {
  if (!pattern.test(text)) {
    throw new Error(`Stamping failed: pattern ${pattern} not found in ${file}. Template may have drifted — check templates/.template-version.`);
  }
  return text.replace(pattern, replacement);
}
