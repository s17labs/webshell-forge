import { createApp } from '../packages/core/src/index.js';

const outDir = process.argv[2] || 'projects/sample';

const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forge Sample</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <main>
        <h1>🐚 Forge Sample</h1>
        <p>Built entirely from HTML/CSS/JS by WebShell Forge.</p>
        <button id="toast-btn">Native toast</button>
        <button id="net-btn">Internet check</button>
        <pre id="out"></pre>
    </main>
    <script src="bridge.js"></script>
    <script src="app.js"></script>
</body>
</html>`;

const css = `* { box-sizing: border-box; }
body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    font-family: system-ui, sans-serif;
    background: linear-gradient(160deg, #141428, #2a1a4a);
    color: #f1f1f7;
}
main { text-align: center; padding: 2rem; }
h1 { margin-bottom: 0.25em; }
p { color: #aab; }
button {
    background: #7c5cff;
    border: none;
    color: white;
    font-size: 1rem;
    padding: 12px 22px;
    border-radius: 10px;
    margin: 6px;
    cursor: pointer;
}
pre {
    text-align: left;
    background: rgba(0,0,0,.35);
    padding: 12px;
    border-radius: 10px;
    max-width: 90vw;
    overflow-x: auto;
    white-space: pre-wrap;
}`;

const js = `const out = document.getElementById('out');
const log = (m) => { out.textContent += m + '\\n'; };

document.getElementById('toast-btn').addEventListener('click', () => {
    if (window.NativeBridge?.toast) {
        NativeBridge.toast('Bridge works!');
        log('toast sent ✅');
    } else {
        log('no native bridge in this context');
    }
});

document.getElementById('net-btn').addEventListener('click', async () => {
    log('fetching…');
    try {
        const res = await fetch('https://api.github.com/zen');
        log('internet OK ✅\\n' + await res.text());
    } catch (e) {
        log('fetch failed: ' + e.message);
    }
});`;

const result = await createApp({
  name: 'Forge Sample',
  description: 'Sample app proving the WebShell Forge pipeline end-to-end.',
  versionName: '1.0.0',
  html,
  css,
  js,
  outputDir: outDir,
});

console.log(`scaffolded ${result.projectDir} (${result.packageName})`);
