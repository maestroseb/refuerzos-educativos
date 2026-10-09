// Prueba de corte de red: la sesión queda en cola, sobrevive a recargar y se envía al volver la conexión.
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, 'out');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.clock.setFixedTime(new Date('2026-10-08T11:20:00+02:00'));
  await p.goto('file://' + path.join(OUT, 'index.html'));
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForSelector('#cSesion .pill');
  await p.evaluate(() => { window.MOCK_FALLO_RED = true; });
  await p.click('.tramo[data-tramo="t5"]');
  await p.click('#cSesion [data-alu]'); await p.click('[data-mat="Lengua"]');
  await p.fill('#trab', 'Prueba sin red'); await p.click('[data-star="3"]'); await p.click('#guardar');
  await p.waitForTimeout(2000);
  console.log('Sin red:', await p.textContent('#cola'));
  await p.screenshot({ path: path.join(OUT, 'r1-sinred.png') });
  console.log('En localStorage:', await p.evaluate(() => JSON.parse(localStorage.getItem('ref.cola')).length));
  p.on('dialog', d => d.accept());
  await p.reload(); await p.waitForTimeout(600);
  console.log('Tras recargar, pendiente en diario:', await p.evaluate(() => S.d.registros.filter(r => r._pend).length));
  await p.evaluate(() => { window.MOCK_FALLO_RED = false; COLA.espera = false; procesarCola(); });
  await p.waitForTimeout(2000);
  console.log('Con red de nuevo, cola:', await p.evaluate(() => COLA.items.length), '| pendientes:', await p.evaluate(() => S.d.registros.filter(r => r._pend).length));
  await b.close();
})();
