import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const APK_REL = path.join('app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

export function buildApp(projectDir, { onLog = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const gradlew = path.join(projectDir, 'gradlew');
    if (!fs.existsSync(gradlew)) {
      reject(new Error(`gradlew not found in ${projectDir}`));
      return;
    }
    fs.chmodSync(gradlew, 0o755);

    const child = spawn('./gradlew', ['assembleDebug', '--no-daemon'], {
      cwd: projectDir,
      env: process.env,
    });

    let stderrTail = '';
    child.stdout.on('data', (d) => streamLines(d, onLog));
    child.stderr.on('data', (d) => {
      stderrTail += d.toString();
      streamLines(d, onLog);
    });
    child.on('error', (err) => reject(new Error(`Failed to launch gradlew: ${err.message}`)));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Gradle build failed with exit code ${code}. ${stderrTail.slice(-2000)}`));
        return;
      }
      const apkPath = path.join(projectDir, APK_REL);
      if (!fs.existsSync(apkPath)) {
        reject(new Error(`Build reported success but APK missing at ${apkPath}`));
        return;
      }
      resolve({ apkPath });
    });
  });
}

export function copyApk(apkPath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(apkPath, destPath);
  return destPath;
}

function streamLines(chunk, onLog) {
  for (const line of chunk.toString().split(/\r?\n|\r/)) {
    if (line.trim()) onLog(line);
  }
}
