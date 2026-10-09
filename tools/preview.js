// Construye tools/out/index.html (incluyendo parciales + mock) y hace capturas.
// Uso: node tools/preview.js [vista...]
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
let html = fs.readFileSync(path.join(R, 'index.html'), 'utf8')
  .replace(/<\?!= include\('([^']+)'\); \?>/g, (_, f) => fs.readFileSync(path.join(R, f + '.html'), 'utf8'));
html = html.replace('<head>', '<head><script>' + fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8') + '</script>');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
if (process.argv[2] === 'build') process.exit(0);
const { chromium } = require('playwright');
const vistas = process.argv.slice(2).length ? process.argv.slice(2) : ['registrar', 'diario', 'datos', 'ajustes'];
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const [nom, vp, dark] of [['movil', { width: 390, height: 844 }, false], ['pc', { width: 1440, height: 900 }, false], ['movil-osc', { width: 390, height: 844 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce', locale: 'es-ES', timezoneId: 'Europe/Madrid' });
    const p = await ctx.newPage();
    await p.clock.setFixedTime(new Date('2026-10-08T11:20:00+02:00'));
    p.on('pageerror', e => errs.push(nom + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(nom + ' console: ' + m.text()); });
    for (const v of vistas) {
      if (dark && v !== 'registrar' && v !== 'datos') continue;
      await p.goto('file://' + path.join(OUT, 'index.html'));
      await p.evaluate(v => localStorage.setItem('ref.vista', JSON.stringify(v)), v);
      await p.reload();
      await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important}' });
      await p.waitForTimeout(900);
      await p.screenshot({ path: path.join(OUT, nom + '-' + v + '.png'), fullPage: true });
    }
    await ctx.close();
  }
  await b.close();
  console.log(errs.length ? 'ERRORES:\n' + errs.join('\n') : 'Sin errores JS');
})();
