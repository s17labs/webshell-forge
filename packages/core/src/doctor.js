import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

export async function doctor() {
  const problems = [];
  const java = await checkJava();
  if (!java.ok) problems.push(java.problem);

  const sdk = checkSdk();
  if (!sdk.ok) problems.push(sdk.problem);

  return {
    ok: problems.length === 0,
    problems,
    javaVersion: java.version || null,
    sdkPath: sdk.path || null,
  };
}

function checkJava() {
  return new Promise((resolve) => {
    execFile('java', ['-version'], (err, _stdout, stderr) => {
      if (err) {
        const hint = /memory|executable|PaX/i.test(String(stderr) + String(err.message))
          ? ' (If running inside a PRoot/proot container, the JVM may need PROOT_NO_SECCOMP=1 or a Termux-built JDK.)'
          : '';
        resolve({ ok: false, problem: `Java not runnable: ${String(stderr).split('\n')[0] || err.message}.${hint}` });
        return;
      }
      const match = /version "(\d+)/.exec(String(stderr));
      const major = match ? Number.parseInt(match[1], 10) : 0;
      if (major < 17) {
        resolve({ ok: false, version: major, problem: `JDK 17+ required for AGP 8.7.3; found ${major || 'unknown'}.` });
        return;
      }
      resolve({ ok: true, version: major });
    });
  });
}

function checkSdk() {
  const root = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || null;
  if (!root) {
    return {
      ok: false,
      path: null,
      problem:
        'ANDROID_HOME is not set. Install Android SDK cmdline-tools, then: sdkmanager "platforms;android-35" "build-tools;35.0.0" and accept licenses.',
    };
  }
  const platformDir = path.join(root, 'platforms', 'android-35');
  if (!fs.existsSync(platformDir)) {
    return {
      ok: false,
      path: root,
      problem: `Android SDK found at ${root} but platforms/android-35 is missing. Run: sdkmanager "platforms;android-35"`,
    };
  }
  return { ok: true, path: root };
}
