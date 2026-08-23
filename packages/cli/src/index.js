#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import { createApp, buildApp, copyApk, doctor, derivePackageId, exportRepo } from '@s17labs/forge-core';

const s = p.spinner();

async function main() {
  p.intro('🐚🔨 WebShell Forge — local HTML/CSS/JS → Android APK');

  const command = await p.select({
    message: 'What do you want to do?',
    options: [
      { value: 'create', label: 'Create a new app' },
      { value: 'export', label: 'Export an existing project as CI-ready repo' },
      { value: 'doctor', label: 'Check build environment (doctor)' },
    ],
  });

  if (p.isCancel(command)) return bail();
  if (command === 'doctor') return runDoctor();
  if (command === 'export') return runExport();

  const name = await p.text({
    message: 'App name',
    placeholder: 'My Cool App',
    validate: (v) => (v.trim() ? undefined : 'Name is required'),
  });
  if (p.isCancel(name)) return bail();

  const description = await p.text({
    message: 'Description',
    placeholder: 'What does your app do?',
  });
  if (p.isCancel(description)) return bail();

  const versionName = await p.text({
    message: 'Version',
    placeholder: '1.0.0',
    defaultValue: '1.0.0',
  });
  if (p.isCancel(versionName)) return bail();

  const pkgDefault = derivePackageId(name);
  const packageName = await p.text({
    message: `Package ID`,
    placeholder: pkgDefault,
    defaultValue: pkgDefault,
  });
  if (p.isCancel(packageName)) return bail();

  const iconPath = await p.text({
    message: 'Icon file path',
    placeholder: '(press Enter to skip — uses default shell icon)',
    validate: (v) => {
      if (!v.trim()) return undefined;
      if (!fs.existsSync(v)) return 'File not found';
      return undefined;
    },
  });
  if (p.isCancel(iconPath)) return bail();

  const htmlPath = await p.text({
    message: 'index.html path',
    placeholder: './index.html',
    validate: (v) => (fs.existsSync(v) ? undefined : 'File not found'),
  });
  if (p.isCancel(htmlPath)) return bail();

  const cssPath = await p.text({
    message: 'style.css path',
    placeholder: './style.css (Enter to skip)',
  });
  if (p.isCancel(cssPath)) return bail();

  const jsPath = await p.text({
    message: 'app.js path',
    placeholder: './app.js (Enter to skip)',
  });
  if (p.isCancel(jsPath)) return bail();

  const outDir = path.resolve(`forge-${Date.now().toString(36)}`);

  s.start('Scaffolding project from vendored webshell template…');
  let result;
  try {
    result = await createApp({
      name,
      description,
      packageName,
      versionName,
      outputDir: outDir,
      iconPath: iconPath.trim() || undefined,
      tolerateIconErrors: true,
      html: fs.readFileSync(htmlPath, 'utf8'),
      css: cssPath.trim() ? fs.readFileSync(cssPath, 'utf8') : '',
      js: jsPath.trim() ? fs.readFileSync(jsPath, 'utf8') : '',
    });
    s.stop('Project scaffolded');
  } catch (err) {
    s.stop(`Scaffold failed: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  p.outcome(`applicationId: ${result.packageName}`);
  p.outcome(`project dir:  ${result.projectDir}`);
  if (iconPath.trim() && !result.iconApplied) {
    p.log.warn('Icon could not be processed — using default shell icon.');
  }

  const doBuild = await p.confirm({ message: 'Build the APK now?', initialValue: true });
  if (p.isCancel(doBuild) || !doBuild) {
    await maybeExport(result.projectDir);
    p.outro(`Done. Run "gradlew assembleDebug" inside ${result.projectDir} when ready.`);
    return;
  }

  s.start('Checking environment…');
  const env = await doctor();
  s.stop(env.ok ? 'Environment OK' : 'Environment problems found');
  for (const problem of env.problems) p.log.error(problem);
  if (!env.ok) {
    p.outro('Fix the issues above and re-run forge.');
    process.exitCode = 1;
    return;
  }

  try {
    const { apkPath } = await buildApp(result.projectDir, {
      onLog: (line) => p.log.step(line),
    });
    const dest = path.join(path.dirname(result.projectDir), result.apkFileName);
    copyApk(apkPath, dest);
    p.outcome(`✅ ${result.apkFileName} → ${dest}`);
    await maybeExport(result.projectDir);
    p.outro(`Install with: adb install "${dest}"`);
  } catch (err) {
    p.log.error(err.message);
    p.note('Full log above. Common fixes: JDK 17 required; ANDROID_HOME must point at an SDK with platforms;android-35.');
    process.exitCode = 1;
  }
}

async function runExport() {
  const sourceDir = await p.text({
    message: 'Project directory (a scaffolded WebShell Forge project)',
    placeholder: './projects/xxxxxx',
    validate: (v) => {
      const dir = path.resolve(v);
      if (!fs.existsSync(path.join(dir, 'gradlew'))) return 'gradlew not found — is this a scaffolded project?';
      return undefined;
    },
  });
  if (p.isCancel(sourceDir)) return bail();
  await maybeExport(path.resolve(sourceDir));
  p.outro('Exported.');
}

async function maybeExport(sourceDir) {
  const doExport = await p.confirm({
    message: 'Export a CI-ready repo? (.zip-free folder + GitHub Actions workflow that builds the APK)',
    initialValue: false,
  });
  if (p.isCancel(doExport) || !doExport) return;

  const defaultOut = `${sourceDir}-android`;
  const outDir = await p.text({
    message: 'Export directory',
    placeholder: defaultOut,
    defaultValue: defaultOut,
  });
  if (p.isCancel(outDir)) return;

  try {
    const info = readProjectInfo(sourceDir);
    exportRepo({
      sourceDir,
      outDir: path.resolve(outDir),
      appName: info.name,
      description: info.description,
      packageName: info.packageName,
      versionName: info.versionName,
    });

    s.start('Preparing export…');
    s.stop('CI-ready repo exported');
    p.log.info(
      `Push it to GitHub and Actions will build your APK:\n` +
        `  cd ${path.resolve(outDir)}\n` +
        `  git init -b main && git add -A && git commit -m "Initial import from WebShell Forge"\n` +
        `  gh repo create <name> --public --source . --push`,
    );
  } catch (err) {
    p.log.error(`Export failed: ${err.message}`);
  }
}

function readProjectInfo(projectDir) {
  let name = '';
  let description = '';
  const appJson = path.join(projectDir, 'app/src/main/assets/www/app.json');
  if (fs.existsSync(appJson)) {
    const parsed = JSON.parse(fs.readFileSync(appJson, 'utf8'));
    name = parsed.name || '';
    description = parsed.description || '';
  }
  const gradle = fs.readFileSync(path.join(projectDir, 'app/build.gradle.kts'), 'utf8');
  const packageName = /applicationId\s*=\s*"([^"]+)"/.exec(gradle)?.[1] ?? '';
  const versionName = /versionName\s*=\s*"([^"]+)"/.exec(gradle)?.[1] ?? '';
  return { name, description, packageName, versionName };
}

async function runDoctor() {
  s.start('Checking environment…');
  const env = await doctor();
  s.stop(env.ok ? 'All good ✅' : 'Problems found');
  if (env.javaVersion) p.outcome(`JDK major version: ${env.javaVersion}`);
  if (env.sdkPath) p.outcome(`Android SDK: ${env.sdkPath}`);
  for (const problem of env.problems) p.log.error(problem);
  if (env.ok) p.outro('Ready to build.');
}

function bail() {
  p.cancel('Operation cancelled.');
  process.exitCode = 0;
}

main().catch((err) => {
  p.log.error(String(err?.message || err));
  process.exitCode = 1;
});
