// Prueba de velocidad: cambios optimistas en Ajustes y arranque con copia local.
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, 'out');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(OUT, 'index.html'));
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForSelector('#cSesion');
  await p.click('[data-view="ajustes"]'); await p.click('[data-tab="alumnado"]');
  const t0 = Date.now();
  await p.click('[data-e]'); await p.fill('#an', 'Prueba Rápida Uno'); await p.click('#aOk');
  await p.waitForSelector('text=Prueba Rápida Uno', { timeout: 500 });
  console.log('Alumno visible en', Date.now() - t0, 'ms; cola:', await p.textContent('#cola'));
  await p.click('[data-tab="alumnado"]'); await (await p.$$('.pills [data-g]'))[1].click();
  await p.fill('#bulk', 'Nuevo Uno\nNuevo Dos'); await p.click('#bOk');
  await p.waitForSelector('text=Nuevo Dos', { timeout: 500 });
  console.log('Bloque visible; cola:', await p.textContent('#cola'));
  await p.waitForSelector('#cola', { state: 'detached', timeout: 8000 });
  console.log('Cola vacía. Nuevo Dos sigue:', !!(await p.$('text=Nuevo Dos')));
  // Arranque: con inicio lento debe pintarse ya desde la copia local.
  await p.evaluate(() => { localStorage.setItem('ref.vista', '"registrar"'); });
  await p.addInitScript(() => { window.MOCK_INICIO_MS = 3000; });
  const t1 = Date.now(); await p.reload();
  await p.waitForSelector('#cSesion', { timeout: 1500 });
  console.log('Arranque con copia en', Date.now() - t1, 'ms');
  console.log('Errores:', errs.length ? errs : 'ninguno');
  await b.close();
})();
