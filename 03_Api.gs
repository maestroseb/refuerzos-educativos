/**
 * Funciones llamadas desde el cliente con google.script.run.
 * inicio() devuelve de una vez todo lo que la app necesita: el volumen de un
 * curso (unos miles de registros) cabe sin problema y permite filtrar y
 * calcular estadísticas en el navegador al instante.
 */

function inicio() {
  exigirAcceso_();
  const c = config_();
  const limpia = function(arr) { return arr.map(limpio_); };
  return {
    yo: yo_(),
    centro: c.CENTRO || '',
    materias: (c.MATERIAS ? c.MATERIAS.split('|') : MATERIAS_DEF),
    motivos: MOTIVOS_DEF,
    sustituciones: sustitucionesMadre_(),
    madreId: c.MADRE_ID || '',
    ultimaSincro: c.ULTIMA_SINCRO || '',
    sincroDiaria: sincroDiariaActiva_(),
    bdUrl: yo_().admin ? bd_().getUrl() : '',
    tramos: limpia(filas_(HOJAS.TRAMOS)),
    grupos: limpia(filas_(HOJAS.GRUPOS)),
    semanas: limpia(filas_(HOJAS.SEMANAS)),
    docentes: filas_(HOJAS.DOCENTES).map(function(d) {
      return { id: d.id, nombre_corto: d.nombre_corto, nombre_completo: d.nombre_completo,
        email: d.email, sustituto: d.sustituto, sustituto_email: d.sustituto_email,
        es_admin: si_(d.es_admin), activo: d.activo === '' ? true : si_(d.activo), origen: d.origen };
    }),
    horarios: limpia(filas_(HOJAS.HORARIOS)),
    alumnado: filas_(HOJAS.ALUMNADO).map(function(a) {
      const r = limpio_(a); r.activo = a.activo === '' ? true : si_(a.activo); return r;
    }),
    registros: filas_(HOJAS.REGISTROS).map(function(r) {
      const o = limpio_(r); o.aprovechamiento = Number(r.aprovechamiento) || 0; return o;
    })
  };
}

/* ---------- Registros ---------- */

function guardarRegistro(r) {
  return conCandado_(function() {
    const a = actorId_(r.docente_id);
    const tz = Session.getScriptTimeZone();
    const fd = new Date(String(r.fecha) + 'T12:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.fecha)) || isNaN(fd) || Utilities.formatDate(fd, tz, 'yyyy-MM-dd') !== r.fecha) throw new Error('Fecha no válida.');
    if (fd.getDay() === 0 || fd.getDay() === 6) throw new Error('La fecha debe ser un día lectivo (lunes a viernes).');
    if (r.fecha > Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd')) throw new Error('No se pueden registrar sesiones futuras.');
    const ids = (r.alumno_ids || []).filter(Boolean);
    const noRealizada = r.estado === 'no_realizada';
    if (noRealizada && !r.motivo) throw new Error('Indica por qué no se realizó.');
    if (!noRealizada && !ids.length) throw new Error('Selecciona al menos un alumno o alumna.');
    if (r.id) {
      const prev = filas_(HOJAS.REGISTROS).filter(function(x) { return x.id === r.id; })[0];
      if (!prev) throw new Error('Ese registro ya no existe.');
      if (prev.docente_id !== a.id && !a.yo.admin) throw new Error('Solo puedes editar tus propios registros.');
    }
    const alumnos = {};
    filas_(HOJAS.ALUMNADO).forEach(function(x) { alumnos[x.id] = x.nombre; });
    const doc = filas_(HOJAS.DOCENTES).filter(function(d) { return d.id === a.id; })[0];
    const ahora = ahoraIso_();
    const fila = {
      id: r.id || '',
      fecha: r.fecha,
      dia: DIAS[(new Date(r.fecha + 'T12:00:00').getDay() + 6) % 7] || '',
      tramo_id: r.tramo_id || '',
      docente_id: a.id,
      grupo_id: r.grupo_id || '',
      alumno_ids: ids.join(','),
      materia: noRealizada ? '' : (r.materia || ''),
      estado: noRealizada ? 'no_realizada' : 'realizada',
      motivo: noRealizada ? String(r.motivo).slice(0, 80) : '',
      trabajado: String(r.trabajado || '').slice(0, 5000),
      aprovechamiento: noRealizada ? 0 : Math.max(0, Math.min(5, Number(r.aprovechamiento) || 0)),
      alumnos_txt: ids.map(function(i) { return alumnos[i] || i; }).join(', '),
      docente_txt: doc ? (doc.nombre_completo || doc.nombre_corto) : '',
      email: a.yo.email,
      actualizado: ahora
    };
    if (!r.id) fila.creado = ahora;
    const g = guardar_(HOJAS.REGISTROS, fila);
    g.aprovechamiento = Number(g.aprovechamiento) || 0;
    return g;
  });
}

function borrarRegistro(id) {
  return conCandado_(function() {
    const yo = yo_();
    const prev = filas_(HOJAS.REGISTROS).filter(function(x) { return x.id === id; })[0];
    if (!prev) return true;
    if (prev.docente_id !== yo.docenteId && !yo.admin) throw new Error('Solo puedes borrar tus propios registros.');
    return borrar_(HOJAS.REGISTROS, id);
  });
}

/* ---------- Alumnado (cualquier docente puede añadir) ---------- */

function guardarAlumno(a) {
  return conCandado_(function() {
    const yo = exigirAcceso_();
    if (a.id && !yo.admin) {
      const prev = filas_(HOJAS.ALUMNADO).filter(function(x) { return x.id === a.id; })[0];
      if (prev && (prev.grupo_id !== a.grupo_id || a.activo === false)) throw new Error('Solo la administración puede cambiar de grupo o archivar alumnado.');
    }
    const nombre = String(a.nombre || '').trim().replace(/\s+/g, ' ');
    if (!nombre) throw new Error('Escribe el nombre.');
    const o = { id: a.id || '', nombre: nombre, grupo_id: a.grupo_id || '',
      activo: a.activo === false ? 'false' : 'true', notas: a.notas || '' };
    if (!a.id) o.creado_por = yo.email;
    const g = guardar_(HOJAS.ALUMNADO, o);
    g.activo = g.activo !== 'false';
    return g;
  });
}

/** Alta en bloque: un nombre por línea. Omite los que ya existen en el grupo. */
function importarAlumnado(texto, grupoId) {
  exigirAdmin_();
  return conCandado_(function() {
    const ya = {};
    filas_(HOJAS.ALUMNADO).forEach(function(x) { if (x.grupo_id === grupoId) ya[x.nombre.toLowerCase()] = 1; });
    const yo = yo_();
    const nuevos = [];
    String(texto || '').split(/\r?\n/).forEach(function(l) {
      const n = l.replace(/^[\s\d.\-–•*)]+/, '').replace(/\t+/g, ' ').trim().replace(/\s+/g, ' ');
      if (!n || ya[n.toLowerCase()]) return;
      ya[n.toLowerCase()] = 1;
      nuevos.push({ id: nuevoId_(), nombre: n, grupo_id: grupoId, activo: 'true', notas: '', creado_por: yo.email });
    });
    if (nuevos.length) reemplazar_(HOJAS.ALUMNADO, nuevos, function() { return false; });
    return nuevos.map(function(n) { n.activo = true; return n; });
  });
}

function borrarAlumno(id) {
  exigirAdmin_();
  return conCandado_(function() {
    const usado = filas_(HOJAS.REGISTROS).some(function(r) { return (',' + r.alumno_ids + ',').indexOf(',' + id + ',') >= 0; });
    if (usado) { guardar_(HOJAS.ALUMNADO, { id: id, activo: 'false' }); return 'archivado'; }
    borrar_(HOJAS.ALUMNADO, id);
    return 'borrado';
  });
}

/* ---------- Administración ---------- */

function guardarDocente(d) {
  exigirAdmin_();
  return conCandado_(function() {
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
    const g = guardar_(HOJAS.DOCENTES, o);
    g.es_admin = si_(g.es_admin); g.activo = si_(g.activo);
    return g;
  });
}

function borrarDocente(id) {
  exigirAdmin_();
  return conCandado_(function() {
    reemplazar_(HOJAS.HORARIOS, [], function(h) { return h.docente_id === id; });
    return borrar_(HOJAS.DOCENTES, id);
  });
}

/** Sustituye las franjas de refuerzo de un docente (las de origen madre que
 *  se toquen pasan a ser manuales y la sincronización ya no las pisa). */
function guardarHorarioDocente(docenteId, franjas) {
  exigirAdmin_();
  return conCandado_(function() {
    const nuevas = (franjas || []).filter(function(f) { return f.dia && f.tramo_id && f.grupo_ids; })
      .map(function(f) {
        return { id: f.id || nuevoId_(), docente_id: docenteId, dia: f.dia, tramo_id: f.tramo_id,
          grupo_ids: [].concat(f.grupo_ids).join(','), semana: f.semana || '', origen: 'manual' };
      });
    reemplazar_(HOJAS.HORARIOS, nuevas, function(h) { return h.docente_id === docenteId; });
    setConfig_('HORARIO_MANUAL_' + docenteId, 'true');
    return nuevas;
  });
}

function guardarAjustes(c) {
  exigirAdmin_();
  return conCandado_(function() {
    if (c.centro != null) setConfig_('CENTRO', String(c.centro).trim());
    if (c.materias) setConfig_('MATERIAS', c.materias.map(function(m) { return String(m).trim(); }).filter(Boolean).join('|'));
    if (c.madreId != null) setConfig_('MADRE_ID', idDeUrl_(c.madreId));
    return true;
  });
}

function guardarTramo(t) {
  exigirAdmin_();
  return conCandado_(function() { return guardar_(HOJAS.TRAMOS, t); });
}

function borrarTramo(id) { exigirAdmin_(); return conCandado_(function() { return borrar_(HOJAS.TRAMOS, id); }); }

function guardarGrupo(g) {
  exigirAdmin_();
  return conCandado_(function() { return guardar_(HOJAS.GRUPOS, g); });
}

function borrarGrupo(id) {
  exigirAdmin_();
  return conCandado_(function() {
    if (filas_(HOJAS.ALUMNADO).some(function(a) { return a.grupo_id === id; })) throw new Error('El grupo tiene alumnado: muévelo antes a otro grupo.');
    return borrar_(HOJAS.GRUPOS, id);
  });
}

function idDeUrl_(s) {
  const m = String(s || '').match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : String(s || '').trim();
}
