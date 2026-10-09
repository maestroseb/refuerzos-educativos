/** Punto de entrada de la Web App: una única página (SPA) compuesta con parciales. */
function doGet() {
  _bd(); // crea la BD la primera vez
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('Refuerzos · Diario de sesiones')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}
