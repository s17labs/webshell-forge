import fs from 'node:fs';
import path from 'node:path';

const WWW_REL = path.join('app', 'src', 'main', 'assets', 'www');

export function writeWebAssets(projectDir, { html, css, js, name, description }) {
  if (!html || !String(html).trim()) {
    throw new Error('HTML content is required (index.html).');
  }
  const wwwDir = path.join(projectDir, WWW_REL);
  fs.mkdirSync(wwwDir, { recursive: true });

  let finalHtml = String(html);
  if (!/<script[^>]*bridge\.js/i.test(finalHtml)) {
    const tag = '<script src="bridge.js"></script>';
    if (/<head[^>]*>/i.test(finalHtml)) {
      finalHtml = finalHtml.replace(/<head[^>]*>/i, (m) => `${m}\n    ${tag}`);
    } else {
      finalHtml = `${tag}\n${finalHtml}`;
    }
  }

  fs.writeFileSync(path.join(wwwDir, 'index.html'), finalHtml);
  if (css != null) fs.writeFileSync(path.join(wwwDir, 'style.css'), String(css));
  if (js != null) fs.writeFileSync(path.join(wwwDir, 'app.js'), String(js));

  fs.writeFileSync(
    path.join(wwwDir, 'app.json'),
    JSON.stringify(
      {
        name: name || '',
        description: description || '',
        generatedBy: 'webshell-forge',
        template: 's17labs/webshell',
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );

  return wwwDir;
}
