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
