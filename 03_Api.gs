/**
 * Funciones llamadas desde el cliente con google.script.run.
 * inicio() devuelve de una vez todo lo que la app necesita: el volumen de un
 * curso (unos miles de registros) cabe sin problema y permite filtrar y
 * calcular estadísticas en el navegador al instante.
 */

function inicio() {
  const c = _config();
  const limpia = function(arr) { return arr.map(_limpio); };
  return {
    yo: _yo(),
    centro: c.CENTRO || '',
    materias: (c.MATERIAS ? c.MATERIAS.split('|') : MATERIAS_DEF),
    madreId: c.MADRE_ID || '',
    ultimaSincro: c.ULTIMA_SINCRO || '',
    sincroDiaria: _sincroDiariaActiva(),
    bdUrl: _yo().admin ? _bd().getUrl() : '',
    tramos: limpia(_filas(HOJAS.TRAMOS)),
    grupos: limpia(_filas(HOJAS.GRUPOS)),
    semanas: limpia(_filas(HOJAS.SEMANAS)),
    docentes: _filas(HOJAS.DOCENTES).map(function(d) {
      return { id: d.id, nombre_corto: d.nombre_corto, nombre_completo: d.nombre_completo,
        email: d.email, sustituto: d.sustituto, sustituto_email: d.sustituto_email,
        es_admin: _si(d.es_admin), activo: d.activo === '' ? true : _si(d.activo), origen: d.origen };
    }),
    horarios: limpia(_filas(HOJAS.HORARIOS)),
    alumnado: _filas(HOJAS.ALUMNADO).map(function(a) {
      const r = _limpio(a); r.activo = a.activo === '' ? true : _si(a.activo); return r;
    }),
    registros: _filas(HOJAS.REGISTROS).map(function(r) {
      const o = _limpio(r); o.aprovechamiento = Number(r.aprovechamiento) || 0; return o;
    })
  };
}

/* ---------- Registros ---------- */

function guardarRegistro(r) {
  return _conCandado(function() {
    const a = _actorId(r.docente_id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.fecha))) throw new Error('Fecha no válida.');
    const ids = (r.alumno_ids || []).filter(Boolean);
    if (!ids.length) throw new Error('Selecciona al menos un alumno o alumna.');
    if (r.id) {
      const prev = _filas(HOJAS.REGISTROS).filter(function(x) { return x.id === r.id; })[0];
      if (!prev) throw new Error('Ese registro ya no existe.');
      if (prev.docente_id !== a.id && !a.yo.admin) throw new Error('Solo puedes editar tus propios registros.');
    }
    const alumnos = {};
    _filas(HOJAS.ALUMNADO).forEach(function(x) { alumnos[x.id] = x.nombre; });
    const doc = _filas(HOJAS.DOCENTES).filter(function(d) { return d.id === a.id; })[0];
    const ahora = _ahoraIso();
    const fila = {
      id: r.id || '',
      fecha: r.fecha,
      dia: DIAS[(new Date(r.fecha + 'T12:00:00').getDay() + 6) % 7] || '',
      tramo_id: r.tramo_id || '',
      docente_id: a.id,
      grupo_id: r.grupo_id || '',
      alumno_ids: ids.join(','),
      materia: r.materia || '',
      trabajado: String(r.trabajado || '').slice(0, 5000),
      aprovechamiento: Math.max(0, Math.min(5, Number(r.aprovechamiento) || 0)),
      alumnos_txt: ids.map(function(i) { return alumnos[i] || i; }).join(', '),
      docente_txt: doc ? (doc.nombre_completo || doc.nombre_corto) : '',
      email: a.yo.email,
      actualizado: ahora
    };
    if (!r.id) fila.creado = ahora;
    const g = _guardar(HOJAS.REGISTROS, fila);
    g.aprovechamiento = Number(g.aprovechamiento) || 0;
    return g;
  });
}

function borrarRegistro(id) {
  return _conCandado(function() {
    const yo = _yo();
    const prev = _filas(HOJAS.REGISTROS).filter(function(x) { return x.id === id; })[0];
    if (!prev) return true;
    if (prev.docente_id !== yo.docenteId && !yo.admin) throw new Error('Solo puedes borrar tus propios registros.');
    return _borrar(HOJAS.REGISTROS, id);
  });
}

/* ---------- Alumnado (cualquier docente puede añadir) ---------- */

function guardarAlumno(a) {
  return _conCandado(function() {
    const yo = _yo();
    if (!yo.docenteId && !yo.admin && !yo.elegible) throw new Error('Sin permiso.');
    const nombre = String(a.nombre || '').trim().replace(/\s+/g, ' ');
    if (!nombre) throw new Error('Escribe el nombre.');
    const o = { id: a.id || '', nombre: nombre, grupo_id: a.grupo_id || '',
      activo: a.activo === false ? 'false' : 'true', notas: a.notas || '' };
    if (!a.id) o.creado_por = yo.email;
    const g = _guardar(HOJAS.ALUMNADO, o);
    g.activo = g.activo !== 'false';
    return g;
  });
}

/** Alta en bloque: un nombre por línea. Omite los que ya existen en el grupo. */
function importarAlumnado(texto, grupoId) {
  _exigirAdmin();
  return _conCandado(function() {
    const ya = {};
    _filas(HOJAS.ALUMNADO).forEach(function(x) { if (x.grupo_id === grupoId) ya[x.nombre.toLowerCase()] = 1; });
    const yo = _yo();
    const nuevos = [];
    String(texto || '').split(/\r?\n/).forEach(function(l) {
      const n = l.replace(/^[\s\d.\-–•*)]+/, '').replace(/\t+/g, ' ').trim().replace(/\s+/g, ' ');
      if (!n || ya[n.toLowerCase()]) return;
      ya[n.toLowerCase()] = 1;
      nuevos.push({ id: _nuevoId(), nombre: n, grupo_id: grupoId, activo: 'true', notas: '', creado_por: yo.email });
    });
    if (nuevos.length) _reemplazar(HOJAS.ALUMNADO, nuevos, function() { return false; });
    return nuevos.map(function(n) { n.activo = true; return n; });
  });
}

function borrarAlumno(id) {
  _exigirAdmin();
  return _conCandado(function() {
    const usado = _filas(HOJAS.REGISTROS).some(function(r) { return (',' + r.alumno_ids + ',').indexOf(',' + id + ',') >= 0; });
    if (usado) { _guardar(HOJAS.ALUMNADO, { id: id, activo: 'false' }); return 'archivado'; }
    _borrar(HOJAS.ALUMNADO, id);
    return 'borrado';
  });
}

/* ---------- Administración ---------- */

function guardarDocente(d) {
  _exigirAdmin();
  return _conCandado(function() {
    if (!String(d.nombre_corto || d.nombre_completo || '').trim()) throw new Error('Escribe el nombre.');
    const o = {
      id: d.id || '', nombre_corto: String(d.nombre_corto || d.nombre_completo).trim(),
      nombre_completo: String(d.nombre_completo || d.nombre_corto).trim(),
      email: String(d.email || '').trim().toLowerCase(),
      sustituto: String(d.sustituto || '').trim(),
      sustituto_email: String(d.sustituto_email || '').trim().toLowerCase(),
      es_admin: d.es_admin ? 'true' : 'false', activo: d.activo === false ? 'false' : 'true'
    };
    if (!d.id) o.origen = 'manual';
    const g = _guardar(HOJAS.DOCENTES, o);
    g.es_admin = _si(g.es_admin); g.activo = _si(g.activo);
    return g;
  });
}

function borrarDocente(id) {
  _exigirAdmin();
  return _conCandado(function() {
    _reemplazar(HOJAS.HORARIOS, [], function(h) { return h.docente_id === id; });
    return _borrar(HOJAS.DOCENTES, id);
  });
}

/** Sustituye las franjas de refuerzo de un docente (las de origen madre que
 *  se toquen pasan a ser manuales y la sincronización ya no las pisa). */
function guardarHorarioDocente(docenteId, franjas) {
  _exigirAdmin();
  return _conCandado(function() {
    const nuevas = (franjas || []).filter(function(f) { return f.dia && f.tramo_id && f.grupo_ids; })
      .map(function(f) {
        return { id: f.id || _nuevoId(), docente_id: docenteId, dia: f.dia, tramo_id: f.tramo_id,
          grupo_ids: [].concat(f.grupo_ids).join(','), semana: f.semana || '', origen: 'manual' };
      });
    _reemplazar(HOJAS.HORARIOS, nuevas, function(h) { return h.docente_id === docenteId; });
    _setConfig('HORARIO_MANUAL_' + docenteId, 'true');
    return nuevas;
  });
}

function guardarAjustes(c) {
  _exigirAdmin();
  return _conCandado(function() {
    if (c.centro != null) _setConfig('CENTRO', String(c.centro).trim());
    if (c.materias) _setConfig('MATERIAS', c.materias.map(function(m) { return String(m).trim(); }).filter(Boolean).join('|'));
    if (c.madreId != null) _setConfig('MADRE_ID', _idDeUrl(c.madreId));
    return true;
  });
}

function guardarTramo(t) {
  _exigirAdmin();
  return _conCandado(function() { return _guardar(HOJAS.TRAMOS, t); });
}

function borrarTramo(id) { _exigirAdmin(); return _conCandado(function() { return _borrar(HOJAS.TRAMOS, id); }); }

function guardarGrupo(g) {
  _exigirAdmin();
  return _conCandado(function() { return _guardar(HOJAS.GRUPOS, g); });
}

function borrarGrupo(id) { _exigirAdmin(); return _conCandado(function() { return _borrar(HOJAS.GRUPOS, id); }); }

function _idDeUrl(s) {
  const m = String(s || '').match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : String(s || '').trim();
}
