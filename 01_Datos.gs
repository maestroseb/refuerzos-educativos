/**
 * Acceso a la hoja-base de datos. Se crea sola la primera vez en el Drive de
 * quien despliega; su id queda en las propiedades del script.
 * Todo se guarda como texto ('@') para que Sheets no convierta fechas/horas.
 */

let _cacheSS = null;
const _cacheFilas = {};

function _bd() {
  if (_cacheSS) return _cacheSS;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(PROP_BD_ID);
  let ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(NOMBRE_BD);
    props.setProperty(PROP_BD_ID, ss.getId());
  }
  _asegurarEsquema(ss);
  _cacheSS = ss;
  return ss;
}

function _asegurarEsquema(ss) {
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

function _hoja(nombre) { return _bd().getSheetByName(nombre); }

function _cabecera(h) {
  return h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0].map(String);
}

/** Todas las filas como objetos {campo: valor}, más _fila (nº de fila). */
function _filas(nombre) {
  if (_cacheFilas[nombre]) return _cacheFilas[nombre];
  const h = _hoja(nombre);
  const n = h.getLastRow();
  if (n < 2) return (_cacheFilas[nombre] = []);
  const datos = h.getRange(1, 1, n, h.getLastColumn()).getDisplayValues();
  const cab = datos[0];
  const out = [];
  for (let i = 1; i < datos.length; i++) {
    if (!datos[i][0]) continue;
    const o = { _fila: i + 1 };
    cab.forEach(function(c, j) { o[c] = datos[i][j]; });
    out.push(o);
  }
  return (_cacheFilas[nombre] = out);
}

function _limpio(o) {
  const r = {};
  Object.keys(o).forEach(function(k) { if (k !== '_fila') r[k] = o[k]; });
  return r;
}

/** Inserta o actualiza (por id) una fila. Devuelve el objeto guardado. */
function _guardar(nombre, obj) {
  const h = _hoja(nombre);
  const cab = _cabecera(h);
  if (!obj.id) obj.id = _nuevoId();
  const previa = _filas(nombre).filter(function(f) { return f.id === obj.id; })[0];
  const base = previa ? _limpio(previa) : {};
  Object.keys(obj).forEach(function(k) { base[k] = obj[k]; });
  const fila = cab.map(function(c) { return base[c] == null ? '' : String(base[c]); });
  if (previa) h.getRange(previa._fila, 1, 1, cab.length).setValues([fila]);
  else h.appendRow(fila);
  delete _cacheFilas[nombre];
  return base;
}

function _borrar(nombre, id) {
  const f = _filas(nombre).filter(function(x) { return x.id === id; })[0];
  if (!f) return false;
  _hoja(nombre).deleteRow(f._fila);
  delete _cacheFilas[nombre];
  return true;
}

/** Sustituye todas las filas que cumplan `quitar` por `nuevas` (en bloque). */
function _reemplazar(nombre, nuevas, quitar) {
  const h = _hoja(nombre);
  const cab = _cabecera(h);
  const quedan = _filas(nombre).filter(function(f) { return quitar ? !quitar(f) : false; })
    .map(_limpio);
  const todas = quedan.concat(nuevas).map(function(o) {
    return cab.map(function(c) { return o[c] == null ? '' : String(o[c]); });
  });
  if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, h.getLastColumn()).clearContent();
  if (todas.length) h.getRange(2, 1, todas.length, cab.length).setValues(todas);
  delete _cacheFilas[nombre];
}

function _nuevoId() { return Utilities.getUuid().slice(0, 8); }

function _config() {
  const c = {};
  _filas(HOJAS.CONFIG).forEach(function(f) { c[f.clave] = f.valor; });
  return c;
}

function _setConfig(clave, valor) {
  const h = _hoja(HOJAS.CONFIG);
  const f = _filas(HOJAS.CONFIG).filter(function(x) { return x.clave === clave; })[0];
  if (f) h.getRange(f._fila, 2).setValue(String(valor));
  else h.appendRow([clave, String(valor)]);
  delete _cacheFilas[HOJAS.CONFIG];
}

function _conCandado(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function _si(v) { return v === true || /^(true|sí|si|1|x|verdadero)$/i.test(String(v || '').trim()); }

function _ahoraIso() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}
