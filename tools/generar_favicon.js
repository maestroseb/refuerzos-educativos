// Genera docs/img/favicon.png (256×256) con el logotipo de la app.
// Uso: node tools/generar_favicon.js   (necesita playwright)
const path = require('path');
const { chromium } = require('playwright');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="256" height="256">
  <rect width="32" height="32" rx="8" fill="#1A1814"/>
  <g transform="translate(3 3) scale(.8125)">
    <path d="M6 25c4-9 9-14 20-18" fill="none" stroke="#F3EFE6" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="9" cy="10" r="3.4" fill="#F3EFE6"/><circle cx="23" cy="22" r="3.4" fill="#F3EFE6"/>
  </g></svg>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 256, height: 256 } });
  await p.setContent('<style>html,body{margin:0;background:transparent}</style>' + svg);
  await p.screenshot({ path: path.join(__dirname, '..', 'docs', 'img', 'favicon.png'), omitBackground: true });
  await b.close();
})();
