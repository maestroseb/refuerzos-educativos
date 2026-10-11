/** Punto de entrada de la Web App: una única página (SPA) compuesta con parciales. */
function doGet() {
  bd_(); // crea la BD la primera vez
  const t = HtmlService.createTemplateFromFile('index');
  // El navegador lo usa para no mostrar la copia local de otra cuenta.
  t.yoEmail = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  return t.evaluate()
    .setTitle('Refuerzos · Diario de sesiones')
    .setFaviconUrl(FAVICON_URL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}
