// Datos simulados + google.script.run falso para previsualizar la app sin Apps Script.
(function () {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const tramos = [['t1', '09:00', '10:00'], ['t2', '10:00', '11:00'], ['t3', '11:00', '11:45'], ['tr', '11:45', '12:15', 1], ['t4', '12:15', '13:15'], ['t5', '13:15', '14:00']]
    .map((t, i) => ({ id: t[0], orden: String(i + 1), hora_inicio: t[1], hora_fin: t[2], etiqueta: '', es_recreo: t[3] ? 'true' : 'false' }));
  const grupos = ['1ºA', '1ºB', '2ºA', '2ºB', '3ºA', '3ºB', '4ºA', '4ºB', '5ºA', '5ºB', '6ºA', '6ºB'].map((g, i) => ({ id: 'g' + i, nombre_corto: g, nombre_largo: g.replace('º', 'º de Primaria '), orden: String(i) }));
  const nd = ['Ana Martín Ruiz', 'Javier López Gil', 'Carmen Ortega Díaz', 'Luis Fernández Mora', 'Marta Sánchez Vega', 'Pablo Romero Ibáñez', 'Elena Castro Navarro', 'Sergio Molina Prieto', 'Lucía Herrera Campos', 'David Ramos Cano'];
  const docentes = nd.map((n, i) => ({ id: 'd' + i, nombre_corto: n.split(' ')[0] + ' ' + n.split(' ')[1][0] + '.', nombre_completo: n, email: 'doc' + i + '@g.educaand.es', sustituto: '', sustituto_email: '', es_admin: i === 0, activo: true, origen: 'madre' }));
  const horarios = [];
  const D = ['L', 'M', 'X', 'J', 'V'];
  docentes.forEach((d, i) => { for (let k = 0; k < 5; k++) horarios.push({ id: 'h' + i + k, docente_id: d.id, dia: D[(i + k) % 5], tramo_id: pick(['t1', 't2', 't3', 't4', 't5']), grupo_ids: pick(grupos).id, semana: '', origen: 'madre' }); });
  // Horario de Ana (d0) bien definido
  horarios.push({ id: 'ha1', docente_id: 'd0', dia: 'J', tramo_id: 't2', grupo_ids: 'g4', semana: '', origen: 'madre' });
  horarios.push({ id: 'ha2', docente_id: 'd0', dia: 'J', tramo_id: 't3', grupo_ids: 'g5,g4', semana: '', origen: 'madre' });
  horarios.push({ id: 'ha3', docente_id: 'd0', dia: 'J', tramo_id: 't5', grupo_ids: 'g8', semana: '', origen: 'madre' });
  const nombres = ['Hugo', 'Lucía', 'Martín', 'Sofía', 'Mateo', 'Martina', 'Leo', 'Valeria', 'Daniel', 'Paula', 'Álex', 'Julia', 'Manuel', 'Daniela', 'Adrián', 'Carla', 'Pablo', 'Sara', 'Álvaro', 'Noa', 'Iker', 'Alba', 'Marco', 'Vega'];
  const apell = ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez'];
  const alumnado = [];
  grupos.forEach(g => { const n = 3 + Math.floor(rnd() * 3); for (let k = 0; k < n; k++) alumnado.push({ id: 'a' + alumnado.length, nombre: pick(nombres) + ' ' + pick(apell) + ' ' + pick(apell), grupo_id: g.id, activo: true, notas: '', creado_por: '' }); });
  const textos = { 'Lengua': ['Lectura en voz alta de un cuento corto y preguntas de comprensión. Mejora la entonación.', 'Dictado de palabras con b/v. Ha cometido menos errores que la semana pasada.', 'Expresión escrita: describir una imagen con 5 frases. Necesita ayuda para empezar.', 'Comprensión lectora con texto informativo; buscar ideas principales.'], 'Matemáticas': ['Cálculo mental con sumas llevando. Muy concentrado.', 'Problemas de dos operaciones con apoyo de dibujos.', 'Tablas del 6 y 7 con juego de cartas. Le cuesta el 7×8.', 'Fracciones con material manipulativo: medios y cuartos.'], 'Otros': ['Organización de la agenda y tareas pendientes.', 'Trabajo de atención con fichas de diferencias.'] };
  const registros = [];
  const hoy = new Date('2026-10-08T12:00:00');
  for (let k = 0; k < 170; k++) {
    const f = new Date(hoy); f.setDate(f.getDate() - Math.floor(rnd() * 38)); if (f.getDay() === 0 || f.getDay() === 6) continue;
    const g = pick(grupos), al = alumnado.filter(a => a.grupo_id === g.id), sel = al.filter(() => rnd() < .55); if (!sel.length) sel.push(al[0]);
    const m = rnd() < .45 ? 'Lengua' : rnd() < .85 ? 'Matemáticas' : 'Otros';
    const iso = f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0');
    registros.push({ id: 'r' + k, fecha: iso, dia: D[f.getDay() - 1], tramo_id: pick(['t1', 't2', 't3', 't4', 't5']), docente_id: k % 4 === 0 ? 'd0' : pick(docentes).id, grupo_id: g.id, alumno_ids: sel.map(a => a.id).join(','), materia: m, trabajado: pick(textos[m]), aprovechamiento: 2 + Math.floor(rnd() * 4), alumnos_txt: '', docente_txt: '', email: '', creado: iso + 'T10:00:00', actualizado: '' });
  }
  // Una sesión de la semana pasada en la misma franja (para preselección)
  registros.push({ id: 'rprev', fecha: '2026-10-01', dia: 'J', tramo_id: 't3', docente_id: 'd0', grupo_id: 'g5', alumno_ids: alumnado.filter(a => a.grupo_id === 'g5').slice(0, 2).map(a => a.id).join(','), materia: 'Matemáticas', trabajado: 'Fracciones equivalentes con tiras de papel. Han entendido la idea de mitad.', aprovechamiento: 4, creado: '2026-10-01T11:50:00' });
  registros.push({ id: 'rhoy', fecha: '2026-10-08', dia: 'J', tramo_id: 't2', docente_id: 'd0', grupo_id: 'g4', alumno_ids: alumnado.filter(a => a.grupo_id === 'g4').slice(0, 1).map(a => a.id).join(','), materia: 'Lengua', trabajado: 'Lectura comprensiva.', aprovechamiento: 3, creado: '2026-10-08T10:58:00' });
  const DB = { yo: { email: 'doc0@g.educaand.es', docenteId: 'd0', comoSustituto: false, admin: true, elegible: false }, centro: 'CEIP Carlos III', materias: ['Lengua', 'Matemáticas', 'Otros'], madreId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789', ultimaSincro: '2026-10-08T06:00:12', sincroDiaria: true, bdUrl: '#', tramos, grupos, semanas: [], docentes, horarios, alumnado, registros };
  if (window.MOCK_VACIO) { DB.tramos = []; DB.registros = []; DB.horarios = []; }
  const handlers = {
    inicio: () => JSON.parse(JSON.stringify(DB)),
    guardarRegistro: r => Object.assign({}, r, { id: r.id || 'n' + Date.now(), alumno_ids: r.alumno_ids.join(','), creado: '2026-10-08T11:30:00' }),
    borrarRegistro: () => true, guardarAlumno: a => Object.assign({ id: 'n' + Date.now(), activo: true }, a),
    sincronizarMadre: () => ({ docentes: 10, grupos: 12, franjas: 53, tramos: 6 }), activarSincroDiaria: v => v,
    guardarAjustes: () => true, guardarDocente: d => d, guardarHorarioDocente: () => [], importarAlumnado: () => []
  };
  function runner(ok, ko) {
    return new Proxy({}, { get: (_, k) => k === 'withSuccessHandler' ? f => runner(f, ko) : k === 'withFailureHandler' ? f => runner(ok, f) : (...a) => setTimeout(() => { try { ok && ok((handlers[k] || (() => null))(...a)); } catch (e) { ko && ko(e); } }, 120) });
  }
  window.google = { script: { run: runner() } };
})();
