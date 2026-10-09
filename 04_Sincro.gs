/**
 * Sincronización con la "hoja madre" (la BD del Gestor de Horarios y
 * Sustituciones, repo maestroseb/organizacion-escolar). Copia tramos,
 * grupos, semanas A/B, docentes y las franjas de refuerzo:
 * ocupaciones de tipo 'localizacion' cuyo rol (o nota) es "Refuerzo", con
 * el grupo destino como grupo a reforzar.
 * Lo creado a mano aquí (docentes, horarios editados) no se pisa.
 */

function sincronizarMadre(idOUrl) {
  exigirAdmin_();
  if (idOUrl) setConfig_('MADRE_ID', idDeUrl_(idOUrl));
  return conCandado_(sincronizar_);
}

/** Ejecutada por el activador diario. Al ser pública, si no la lanza un
 *  activador real del proyecto exige administración. */
function sincroDiaria(e) {
  const uid = e && e.triggerUid;
  const esActivador = !!uid && ScriptApp.getProjectTriggers().some(function(t) { return t.getUniqueId() === String(uid); });
  if (!esActivador) exigirAdmin_();
  conCandado_(sincronizar_);
}

function sincronizar_() {
  const id = config_().MADRE_ID;
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
  if (!tramos.length || !grupos.length || !docentes.length) throw new Error('La hoja no parece la hoja madre: faltan tramos, grupos o docentes (no se ha cambiado nada).');

  reemplazar_(HOJAS.TRAMOS, tramos.map(function(t) {
    return { id: s(t.id), orden: s(t.orden), hora_inicio: hhmm(t.hora_inicio), hora_fin: hhmm(t.hora_fin),
      etiqueta: s(t.etiqueta), es_recreo: si_(t.es_recreo) ? 'true' : 'false' };
  }));
  reemplazar_(HOJAS.GRUPOS, grupos.map(function(g) {
    return { id: s(g.id), nombre_corto: s(g.nombre_corto), nombre_largo: s(g.nombre_largo), orden: s(g.orden) };
  }));
  reemplazar_(HOJAS.SEMANAS, semanas.map(function(w) {
    return { id: s(w.id), fecha_inicio: fecha(w.fecha_inicio), fecha_fin: fecha(w.fecha_fin), tipo: s(w.tipo).toUpperCase() };
  }));

  // Docentes: actualiza los de la madre conservando es_admin; no toca los manuales.
  const locales = {};
  filas_(HOJAS.DOCENTES).forEach(function(d) { locales[d.id] = d; });
  const deMadre = docentes.filter(function(d) { return d.activo == null || d.activo === '' || si_(d.activo); }).map(function(d) {
    const loc = locales[s(d.id)] || {};
    // Lo que la madre no trae se conserva de lo editado aquí.
    return { id: s(d.id), nombre_corto: s(d.nombre_corto), nombre_completo: s(d.nombre_completo) || s(d.nombre_corto),
      email: s(d.email).toLowerCase() || loc.email || '',
      sustituto: s(d.sustituto) || loc.sustituto || '', sustituto_email: s(d.sustituto_email).toLowerCase() || loc.sustituto_email || '',
      es_admin: loc.es_admin || 'false', activo: loc.activo || 'true', origen: 'madre' };
  });
  reemplazar_(HOJAS.DOCENTES, deMadre, function(d) { return d.origen !== 'manual'; });

  // Franjas de refuerzo.
  const rolById = {};
  roles.forEach(function(r) { rolById[s(r.id)] = r; });
  const esRefuerzo = function(o) {
    const r = rolById[s(o.rol_loc_id)];
    const t = r ? s(r.nombre) + ' ' + s(r.nombre_largo) : s(o.notas);
    return /^\s*ref|refuerzo/i.test(t);
  };
  const c = config_();
  const franjas = ocup.filter(function(o) {
    return s(o.tipo) === 'localizacion' && s(o.grupo_destino_id) && esRefuerzo(o) &&
      c['HORARIO_MANUAL_' + s(o.docente_id)] !== 'true';
  }).map(function(o) {
    return { id: s(o.id), docente_id: s(o.docente_id), dia: diaCanon_(o.dia), tramo_id: s(o.tramo_id),
      grupo_ids: s(o.grupo_destino_id).replace(/\s+/g, ''), semana: s(o.semana).toUpperCase(), origen: 'madre' };
  });
  reemplazar_(HOJAS.HORARIOS, franjas, function(h) { return h.origen === 'madre'; });

  const nombre = leer('_Centro')[0];
  if (nombre && !c.CENTRO) setConfig_('CENTRO', s(nombre.nombre));
  setConfig_('ULTIMA_SINCRO', ahoraIso_());
  try { CacheService.getScriptCache().remove('SUST_' + id); } catch (e) {}
  return { tramos: tramos.length, grupos: grupos.length, docentes: deMadre.length, franjas: franjas.length };
}

function diaCanon_(d) {
  const t = String(d || '').trim().toUpperCase();
  if (t.indexOf('MI') === 0) return 'X';
  return t.charAt(0);
}

function activarSincroDiaria(activar) {
  exigirAdmin_();
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'sincroDiaria') ScriptApp.deleteTrigger(t);
  });
  if (activar) ScriptApp.newTrigger('sincroDiaria').timeBased().everyDays(1).atHour(6).create();
  return sincroDiariaActiva_();
}

function sincroDiariaActiva_() {
  try {
    return ScriptApp.getProjectTriggers().some(function(t) { return t.getHandlerFunction() === 'sincroDiaria'; });
  } catch (e) { return false; }
}

/**
 * Sustituciones de la hoja madre (últimos 120 días y próximos 7), leídas en
 * directo y cacheadas 5 minutos: sirven para avisar de que un refuerzo no
 * pudo hacerse porque el docente estaba sustituyendo.
 */
function sustitucionesMadre_() {
  const id = config_().MADRE_ID;
  if (!id) return [];
  const cache = CacheService.getScriptCache();
  const enCache = cache.get('SUST_' + id);
  if (enCache) return JSON.parse(enCache);
  let out = [];
  try {
    const ss = SpreadsheetApp.openById(id);
    const h = ss.getSheetByName('_Sustituciones');
    if (h && h.getLastRow() > 1) {
      const tz = ss.getSpreadsheetTimeZone();
      const v = h.getRange(1, 1, h.getLastRow(), h.getLastColumn()).getValues();
      const cab = v[0].map(String), col = function(n) { return cab.indexOf(n); };
      const cF = col('fecha'), cA = col('docente_ausente_id'), cS = col('docente_sustituto_id'), cT = col('tramo_id'), cG = col('grupo_id');
      const hoy = new Date();
      const desde = Utilities.formatDate(new Date(hoy.getTime() - 120 * 864e5), tz, 'yyyy-MM-dd');
      const hasta = Utilities.formatDate(new Date(hoy.getTime() + 7 * 864e5), tz, 'yyyy-MM-dd');
      out = v.slice(1).map(function(f) {
        const fe = f[cF] instanceof Date ? Utilities.formatDate(f[cF], tz, 'yyyy-MM-dd') : String(f[cF] || '').slice(0, 10);
        return { fecha: fe, ausente_id: String(f[cA] || ''), sustituto_id: String(f[cS] || ''), tramo_id: String(f[cT] || ''), grupo_id: cG >= 0 ? String(f[cG] || '') : '' };
      }).filter(function(x) { return x.fecha >= desde && x.fecha <= hasta && x.sustituto_id && x.tramo_id; });
    }
  } catch (e) { out = []; }
  try { cache.put('SUST_' + id, JSON.stringify(out), 300); } catch (e) {}
  return out;
}
