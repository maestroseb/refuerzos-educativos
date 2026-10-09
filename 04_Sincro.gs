/**
 * Sincronización con la "hoja madre" (la BD del Gestor de Horarios y
 * Sustituciones, repo maestroseb/organizacion-escolar). Copia tramos,
 * grupos, semanas A/B, docentes y las franjas de refuerzo:
 * ocupaciones de tipo 'localizacion' cuyo rol (o nota) es "Refuerzo", con
 * el grupo destino como grupo a reforzar.
 * Lo creado a mano aquí (docentes, horarios editados) no se pisa.
 */

function sincronizarMadre(idOUrl) {
  _exigirAdmin();
  if (idOUrl) _setConfig('MADRE_ID', _idDeUrl(idOUrl));
  return _conCandado(_sincronizar);
}

/** Ejecutada por el activador diario (sin usuario: no exige admin). */
function sincroDiaria() { _conCandado(_sincronizar); }

function _sincronizar() {
  const id = _config().MADRE_ID;
  if (!id) throw new Error('Falta el enlace de la hoja madre.');
  let madre;
  try { madre = SpreadsheetApp.openById(id); }
  catch (e) { throw new Error('No puedo abrir la hoja madre. Comprueba el enlace y que quien despliega tenga acceso.'); }
  const tz = madre.getSpreadsheetTimeZone();
  const leer = function(nombre) {
    const h = madre.getSheetByName(nombre);
    if (!h || h.getLastRow() < 2) return [];
    const v = h.getRange(1, 1, h.getLastRow(), h.getLastColumn()).getValues();
    const cab = v[0].map(String);
    return v.slice(1).filter(function(f) { return f[0] !== '' && f[0] != null; }).map(function(f) {
      const o = {};
      cab.forEach(function(c, j) { o[c] = f[j]; });
      return o;
    });
  };
  const hhmm = function(x) {
    if (x instanceof Date) return Utilities.formatDate(x, tz, 'HH:mm');
    const m = String(x || '').match(/(\d{1,2}):(\d{2})/);
    return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
  };
  const fecha = function(x) {
    if (x instanceof Date) return Utilities.formatDate(x, tz, 'yyyy-MM-dd');
    return String(x || '').slice(0, 10);
  };
  const s = function(x) { return x == null ? '' : String(x).trim(); };

  const tramos = leer('_Tramos');
  const grupos = leer('_Grupos');
  const docentes = leer('_Docentes');
  const roles = leer('_RolesEspeciales');
  const ocup = leer('_Ocupaciones');
  const semanas = leer('_SemanasAlternas');
  if (!tramos.length && !ocup.length) throw new Error('La hoja no parece la hoja madre (no encuentro _Tramos ni _Ocupaciones).');

  _reemplazar(HOJAS.TRAMOS, tramos.map(function(t) {
    return { id: s(t.id), orden: s(t.orden), hora_inicio: hhmm(t.hora_inicio), hora_fin: hhmm(t.hora_fin),
      etiqueta: s(t.etiqueta), es_recreo: _si(t.es_recreo) ? 'true' : 'false' };
  }));
  _reemplazar(HOJAS.GRUPOS, grupos.map(function(g) {
    return { id: s(g.id), nombre_corto: s(g.nombre_corto), nombre_largo: s(g.nombre_largo), orden: s(g.orden) };
  }));
  _reemplazar(HOJAS.SEMANAS, semanas.map(function(w) {
    return { id: s(w.id), fecha_inicio: fecha(w.fecha_inicio), fecha_fin: fecha(w.fecha_fin), tipo: s(w.tipo).toUpperCase() };
  }));

  // Docentes: actualiza los de la madre conservando es_admin; no toca los manuales.
  const locales = {};
  _filas(HOJAS.DOCENTES).forEach(function(d) { locales[d.id] = d; });
  const deMadre = docentes.filter(function(d) { return d.activo === '' || _si(d.activo); }).map(function(d) {
    const loc = locales[s(d.id)];
    return { id: s(d.id), nombre_corto: s(d.nombre_corto), nombre_completo: s(d.nombre_completo) || s(d.nombre_corto),
      email: s(d.email).toLowerCase(), sustituto: s(d.sustituto), sustituto_email: s(d.sustituto_email).toLowerCase(),
      es_admin: loc ? loc.es_admin : 'false', activo: 'true', origen: 'madre' };
  });
  _reemplazar(HOJAS.DOCENTES, deMadre, function(d) { return d.origen !== 'manual'; });

  // Franjas de refuerzo.
  const rolById = {};
  roles.forEach(function(r) { rolById[s(r.id)] = r; });
  const esRefuerzo = function(o) {
    const r = rolById[s(o.rol_loc_id)];
    const t = r ? s(r.nombre) + ' ' + s(r.nombre_largo) : s(o.notas);
    return /^\s*ref|refuerzo/i.test(t);
  };
  const c = _config();
  const franjas = ocup.filter(function(o) {
    return s(o.tipo) === 'localizacion' && s(o.grupo_destino_id) && esRefuerzo(o) &&
      c['HORARIO_MANUAL_' + s(o.docente_id)] !== 'true';
  }).map(function(o) {
    return { id: s(o.id), docente_id: s(o.docente_id), dia: _diaCanon(o.dia), tramo_id: s(o.tramo_id),
      grupo_ids: s(o.grupo_destino_id).replace(/\s+/g, ''), semana: s(o.semana).toUpperCase(), origen: 'madre' };
  });
  _reemplazar(HOJAS.HORARIOS, franjas, function(h) { return h.origen === 'madre'; });

  const nombre = leer('_Centro')[0];
  if (nombre && !c.CENTRO) _setConfig('CENTRO', s(nombre.nombre));
  _setConfig('ULTIMA_SINCRO', _ahoraIso());
  return { tramos: tramos.length, grupos: grupos.length, docentes: deMadre.length, franjas: franjas.length };
}

function _diaCanon(d) {
  const t = String(d || '').trim().toUpperCase();
  if (t.indexOf('MI') === 0) return 'X';
  return t.charAt(0);
}

function activarSincroDiaria(activar) {
  _exigirAdmin();
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'sincroDiaria') ScriptApp.deleteTrigger(t);
  });
  if (activar) ScriptApp.newTrigger('sincroDiaria').timeBased().everyDays(1).atHour(6).create();
  return _sincroDiariaActiva();
}

function _sincroDiariaActiva() {
  try {
    return ScriptApp.getProjectTriggers().some(function(t) { return t.getHandlerFunction() === 'sincroDiaria'; });
  } catch (e) { return false; }
}
