import fs from 'node:fs';
import path from 'node:path';
import { scaffoldTemplate } from './scaffold.js';
import { stampProject } from './stamp.js';
import { stampIcon } from './icons.js';
import { writeWebAssets } from './www.js';
import { apkSlug, derivePackageId, isValidPackageId } from './util.js';

export { scaffoldTemplate } from './scaffold.js';
export { stampProject } from './stamp.js';
export { stampIcon } from './icons.js';
export { writeWebAssets } from './www.js';
export { buildApp, copyApk } from './build.js';
export { doctor } from './doctor.js';
export {
  derivePackageId,
  slugify,
  isValidPackageId,
  apkSlug,
  normalizeVersionName,
} from './util.js';
export { TEMPLATE_DIR, templateVersion } from './paths.js';

export async function createApp(options = {}) {
  const name = (options.name || '').trim();
  if (!name) throw new Error('App name is required.');

  const packageName = String(options.packageName || '').trim() || deriveSafePackageId(name);
  const versionName = options.versionName ?? '1.0.0';
  const versionCode = options.versionCode ?? 1;

  const projectDir = scaffoldTemplate(options.outputDir);

  try {
    stampProject(projectDir, { name, packageName, versionCode, versionName });
    writeWebAssets(projectDir, {
      html: options.html,
      css: options.css ?? '',
      js: options.js ?? '',
      name,
      description: options.description || '',
    });

    let iconApplied = false;
    if (options.iconPath) {
      try {
        await stampIcon(projectDir, options.iconPath, options.iconBackgroundColor || '#6200EE');
        iconApplied = true;
      } catch (err) {
        if (!options.tolerateIconErrors) throw err;
        console.warn(`[forge] icon skipped: ${err.message}`);
      }
    }

    return {
      projectDir,
      packageName,
      versionName,
      versionCode,
      apkFileName: `${apkSlug(name)}-v${versionName}-debug.apk`,
      iconApplied,
    };
  } catch (err) {
    fs.rmSync(projectDir, { recursive: true, force: true });
    throw err;
  }
}

function deriveSafePackageId(name) {
  const id = derivePackageId(name);
  if (!isValidPackageId(id)) {
    throw new Error(`Could not derive a valid applicationId from name "${name}". Provide one explicitly.`);
  }
  return id;
}
