const $ = (id) => document.getElementById(id);

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My App</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1 id="greeting">Hello 👋</h1>
        <p>Edit this code in the tabs on the left — the preview updates live.</p>
        <button onclick="ping()">Ping the native bridge</button>
        <p id="status"></p>
    </div>
    <script src="bridge.js"><\/script>
    <script src="app.js"><\/script>
</body>
</html>`;

const SAMPLE_CSS = `body {
    margin: 0;
    font-family: system-ui, sans-serif;
    background: #12121c;
    color: #f1f1f7;
    display: grid;
    place-items: center;
    min-height: 100vh;
}

.container {
    text-align: center;
    padding: 2rem;
}

button {
    background: #7c5cff;
    color: white;
    border: none;
    border-radius: 10px;
    padding: 12px 22px;
    font-size: 1rem;
    cursor: pointer;
}

#status { color: #9aa; min-height: 1.4em; }`;

const SAMPLE_JS = `function ping() {
    document.getElementById('status').textContent = 'pinging…';
    if (window.NativeBridge && NativeBridge.toast) {
        NativeBridge.toast('Bridge works!');
        document.getElementById('status').textContent = 'toast sent to Android ✅';
    } else {
        document.getElementById('status').textContent = 'no bridge here (browser preview)';
    }
}`;

$('code-html').value = SAMPLE_HTML;
$('code-css').value = SAMPLE_CSS;
$('code-js').value = SAMPLE_JS;

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.code').forEach((c) => c.classList.remove('active'));
    tab.classList.add('active');
    $(`code-${tab.dataset.tab}`).classList.add('active');
  });
});

let iconDataUrl = null;
$('f-icon').addEventListener('change', () => {
  const file = $('f-icon').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    iconDataUrl = reader.result;
    const img = $('icon-preview');
    img.src = iconDataUrl;
    img.hidden = false;
  };
  reader.readAsDataURL(file);
});

const BRIDGE_STUB = `<script>
window.NativeBridge = {
  toast: (m) => { console.log('[bridge] toast:', m); },
  vibrate: () => {},
  getInfo: async () => ({ platform: 'preview' }),
};
<\/script>`;

function composePreview() {
  let html = $('code-html').value;
  html = html.replace(/<script[^>]*src=["']bridge\.js["'][^>]*><\/script>/gi, '');
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${BRIDGE_STUB}`);
  } else {
    html = BRIDGE_STUB + html;
  }
  const css = `<style>\n${$('code-css').value}\n</style>`;
  const js = `<script>\ntry {\n${$('code-js').value}\n} catch (e) { console.error(e); }\n<\/script>`;
  if (html.includes('</head>')) html = html.replace('</head>', `${css}\n</head>`);
  else html = css + html;
  html = html.replace(/<\/body>/i, `${js}\n</body>`);
  return html;
}

let previewTimer;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    $('preview').srcdoc = composePreview();
  }, 400);
}
['code-html', 'code-css', 'code-js'].forEach((id) => $(id).addEventListener('input', schedulePreview));
schedulePreview();

async function build() {
  const name = $('f-name').value.trim();
  if (!name) return setStatus('App name is required.', true);

  const btn = $('btn-build');
  btn.disabled = true;
  setStatus('Scaffolding…');
  const con = $('console');
  con.textContent = '';
  con.hidden = false;
  $('result').hidden = true;

  try {
    const payload = {
      name,
      description: $('f-desc').value,
      packageName: $('f-pkg').value.trim() || undefined,
      versionName: $('f-version').value.trim() || '1.0.0',
      iconDataUrl,
      iconBackgroundColor: $('f-icon-bg').value,
      html: $('code-html').value,
      css: $('code-css').value,
      js: $('code-js').value,
    };

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const project = await res.json();
    if (!res.ok) throw new Error(project.error || 'Scaffold failed');

    setStatus('Building… (first run downloads Gradle + deps)');
    await new Promise((resolve, reject) => {
      const es = new EventSource(`/api/build/${encodeURIComponent(project.id)}`);
      es.addEventListener('log', (e) => {
        const { line } = JSON.parse(e.data);
        con.textContent += line + '\n';
        con.scrollTop = con.scrollHeight;
      });
      es.addEventListener('done', (e) => {
        es.close();
        const { apkUrl, fileName } = JSON.parse(e.data);
        $('apk-link').href = apkUrl;
        $('apk-link').textContent = `⬇ ${fileName}`;
        $('result').hidden = false;
        setStatus('Build complete ✅');
        resolve();
      });
      es.addEventListener('error', (e) => {
        es.close();
        let msg = 'Build failed';
        if (e.data) msg = JSON.parse(e.data).error || msg;
        reject(new Error(msg));
      });
    });
  } catch (err) {
    setStatus(String(err.message || err), true);
    con.textContent += `\n✖ ${err.message || err}\n`;
  } finally {
    btn.disabled = false;
  }
}

function setStatus(text, isError = false) {
  const el = $('build-status');
  el.textContent = text;
  el.className = isError ? 'err' : 'ok';
}

$('btn-build').addEventListener('click', build);

fetch('/api/health').catch(() => setStatus('Server unreachable', true));
