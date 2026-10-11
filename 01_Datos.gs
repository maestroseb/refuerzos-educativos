/**
 * Acceso a la hoja-base de datos. Se crea sola la primera vez en el Drive de
 * quien despliega; su id queda en las propiedades del script.
 * Todo se guarda como texto ('@') para que Sheets no convierta fechas/horas.
 */

let cacheSS_ = null;
const cacheFilas_ = {};
// Curso que se consulta en esta petición (solo lectura); null = el activo.
let cursoSel_ = null;

/* ---------- Cursos académicos: una hoja por curso ----------
   Las propiedades del script guardan, por proyecto (las copias del script
   para otros centros no heredan las hojas), la lista de cursos con su hoja
   y cuál es el activo. */
const sid_ = function() { return ScriptApp.getScriptId(); };
function cursos_() {
  const props = PropertiesService.getScriptProperties();
  let lista = JSON.parse(props.getProperty('CURSOS_' + sid_()) || '[]');
  if (!lista.length) {
    // Primera vez (o instalación anterior): con candado para no crear dos hojas.
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      lista = JSON.parse(props.getProperty('CURSOS_' + sid_()) || '[]');
      if (lista.length) return lista;
    // Migración: la hoja que ya existía pasa a ser la del curso en vigor.
    let id = props.getProperty(PROP_BD_ID + '_' + sid_()) || props.getProperty(PROP_BD_ID);
    if (!id) { id = SpreadsheetApp.create(NOMBRE_BD + ' · ' + cursoDeFecha_(new Date())).getId(); }
    lista = [{ curso: cursoDeFecha_(new Date()), id: id }];
    props.setProperty('CURSOS_' + sid_(), JSON.stringify(lista));
    props.setProperty('CURSO_' + sid_(), lista[0].curso);
    props.deleteProperty(PROP_BD_ID);
    props.deleteProperty(PROP_BD_ID + '_' + sid_());
    } finally { lock.releaseLock(); }
  }
  return lista;
}
function cursoActivo_() {
  const lista = cursos_();
  const act = PropertiesService.getScriptProperties().getProperty('CURSO_' + sid_());
  return lista.filter(function(c) { return c.curso === act; })[0] || lista[lista.length - 1];
}
/** «2026-27» para fechas desde septiembre; «2025-26» antes. */
function cursoDeFecha_(d) {
  const y = d.getFullYear(), m = d.getMonth();
  const a = m >= 8 ? y : y - 1;
  return a + '-' + String(a + 1).slice(-2);
}
function siguienteCurso_(c) {
  const a = Number(String(c).slice(0, 4)) + 1;
  return a + '-' + String(a + 1).slice(-2);
}
/** Pasa a consultar otro curso (solo lectura) en esta petición. */
function usarCurso_(curso) {
  const c = cursos_().filter(function(x) { return x.curso === curso; })[0];
  if (!c) throw new Error('Ese curso no existe.');
  if (c.curso === cursoActivo_().curso) return false;
  cursoSel_ = c;
  cacheSS_ = null;
  Object.keys(cacheFilas_).forEach(function(k) { delete cacheFilas_[k]; });
  return true;
}

function bd_() {
  if (cacheSS_) return cacheSS_;
  const props = PropertiesService.getScriptProperties();
  const c = cursoSel_ || cursoActivo_();
  // Si la hoja falla al abrir (error transitorio) se lanza el error: nunca se
  // crea otra, que dejaría huérfanos los datos reales.
  const ss = SpreadsheetApp.openById(c.id);
  // El esquema solo se revisa cuando cambia (evita ~20 lecturas por petición).
  const firma = JSON.stringify(ESQUEMA).length;
  if (props.getProperty('ESQUEMA_OK_' + c.id) !== String(firma)) {
    asegurarEsquema_(ss);
    props.setProperty('ESQUEMA_OK_' + c.id, String(firma));
  }
  cacheSS_ = ss;
  return ss;
}

function asegurarEsquema_(ss) {
  Object.keys(ESQUEMA).forEach(function(nombre) {
    let h = ss.getSheetByName(nombre);
    const cab = ESQUEMA[nombre];
    if (!h) {
      h = ss.insertSheet(nombre);
      h.getRange('A:Z').setNumberFormat('@');
      h.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
      h.setFrozenRows(1);
    } else {
      // Añade columnas nuevas del esquema que falten (migraciones suaves).
      const actual = h.getRange(1, 1, 1, Math.max(1, h.getLastColumn())).getValues()[0];
      cab.forEach(function(c) {
        if (actual.indexOf(c) < 0) {
          h.getRange(1, h.getLastColumn() + 1).setValue(c).setFontWeight('bold');
        }
      });
    }
  });
  const sobra = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (sobra && ss.getSheets().length > 1) ss.deleteSheet(sobra);
}

function hoja_(nombre) { return bd_().getSheetByName(nombre); }

function cabecera_(h) {
  return h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0].map(String);
}

/** Todas las filas como objetos {campo: valor}, más _fila (nº de fila). */
function filas_(nombre) {
  if (cacheFilas_[nombre]) return cacheFilas_[nombre];
  const h = hoja_(nombre);
  const n = h.getLastRow();
  if (n < 2) return (cacheFilas_[nombre] = []);
  const datos = h.getRange(1, 1, n, h.getLastColumn()).getDisplayValues();
  const cab = datos[0];
  const out = [];
  for (let i = 1; i < datos.length; i++) {
    if (!datos[i][0]) continue;
    const o = { _fila: i + 1 };
    cab.forEach(function(c, j) { o[c] = datos[i][j]; });
    out.push(o);
  }
  return (cacheFilas_[nombre] = out);
}

function limpio_(o) {
  const r = {};
  Object.keys(o).forEach(function(k) { if (k !== '_fila') r[k] = o[k]; });
  return r;
}

/** Inserta o actualiza (por id) una fila. Devuelve el objeto guardado. */
function guardar_(nombre, obj) {
  const h = hoja_(nombre);
  const cab = cabecera_(h);
  if (!obj.id) obj.id = nuevoId_();
  const previa = filas_(nombre).filter(function(f) { return f.id === obj.id; })[0];
  const base = previa ? limpio_(previa) : {};
  Object.keys(obj).forEach(function(k) { base[k] = obj[k]; });
  const fila = cab.map(function(c) { return base[c] == null ? '' : String(base[c]); });
  if (previa) h.getRange(previa._fila, 1, 1, cab.length).setValues([fila]);
  else h.appendRow(fila);
  delete cacheFilas_[nombre];
  return base;
}

function borrar_(nombre, id) {
  const f = filas_(nombre).filter(function(x) { return x.id === id; })[0];
  if (!f) return false;
  hoja_(nombre).deleteRow(f._fila);
  delete cacheFilas_[nombre];
  return true;
}

/** Sustituye todas las filas que cumplan `quitar` por `nuevas` (en bloque). */
function reemplazar_(nombre, nuevas, quitar) {
  const h = hoja_(nombre);
  const cab = cabecera_(h);
  const quedan = filas_(nombre).filter(function(f) { return quitar ? !quitar(f) : false; })
    .map(limpio_);
  const todas = quedan.concat(nuevas).map(function(o) {
    return cab.map(function(c) { return o[c] == null ? '' : String(o[c]); });
  });
  if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, h.getLastColumn()).clearContent();
  if (todas.length + 1 > h.getMaxRows()) h.insertRowsAfter(h.getMaxRows(), todas.length + 1 - h.getMaxRows());
  if (todas.length) h.getRange(2, 1, todas.length, cab.length).setValues(todas);
  delete cacheFilas_[nombre];
}

/** Id generado en el navegador (altas optimistas): valida el formato y
 *  devuelve la fila previa con ese id, si existe (reintento o edición). */
function previa_(nombre, id) {
  if (!id) return null;
  const f = filas_(nombre).filter(function(x) { return x.id === id; })[0];
  if (f) return f;
  // Solo las altas nuevas deben traer un id con formato del navegador; los ya
  // existentes (p. ej. los de la hoja madre: «DOC_001») se aceptan tal cual.
  if (!/^[a-z0-9-]{6,40}$/i.test(String(id))) throw new Error('Id no válido.');
  return null;
}

function nuevoId_() { return Utilities.getUuid().slice(0, 8); }

function config_() {
  const c = {};
  filas_(HOJAS.CONFIG).forEach(function(f) { c[f.clave] = f.valor; });
  return c;
}

function setConfig_(clave, valor) {
  const h = hoja_(HOJAS.CONFIG);
  const f = filas_(HOJAS.CONFIG).filter(function(x) { return x.clave === clave; })[0];
  if (f) h.getRange(f._fila, 2).setValue(String(valor));
  else h.appendRow([clave, String(valor)]);
  delete cacheFilas_[HOJAS.CONFIG];
}

function conCandado_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  // Lo leído antes del candado puede estar desfasado (y con nº de fila viejo).
  Object.keys(cacheFilas_).forEach(function(k) { delete cacheFilas_[k]; });
  yoMemo_ = null;
  try { return fn(); } finally { lock.releaseLock(); }
}

function si_(v) { return v === true || /^(true|sí|si|1|x|verdadero)$/i.test(String(v || '').trim()); }

function ahoraIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}
