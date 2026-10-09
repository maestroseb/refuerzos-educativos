/**
 * Constantes: nombres de pestañas de la BD y sus cabeceras (fila 1).
 * El resto del código accede a los campos por nombre, nunca por índice.
 */
const PROP_BD_ID = 'BD_ID';
const NOMBRE_BD = 'Refuerzos educativos — Base de datos';
const MATERIAS_DEF = ['Lengua', 'Matemáticas', 'Otros'];

const HOJAS = {
  CONFIG:    'Config',
  REGISTROS: 'Registros',
  ALUMNADO:  'Alumnado',
  DOCENTES:  'Docentes',
  HORARIOS:  'Horarios',
  TRAMOS:    'Tramos',
  GRUPOS:    'Grupos',
  SEMANAS:   'Semanas'
};

const ESQUEMA = {
  [HOJAS.CONFIG]:    ['clave', 'valor'],
  [HOJAS.REGISTROS]: ['id', 'fecha', 'dia', 'tramo_id', 'docente_id', 'grupo_id',
                      'alumno_ids', 'materia', 'trabajado', 'aprovechamiento',
                      'alumnos_txt', 'docente_txt', 'email', 'creado', 'actualizado'],
  [HOJAS.ALUMNADO]:  ['id', 'nombre', 'grupo_id', 'activo', 'notas', 'creado_por'],
  [HOJAS.DOCENTES]:  ['id', 'nombre_corto', 'nombre_completo', 'email',
                      'sustituto', 'sustituto_email', 'es_admin', 'activo', 'origen'],
  [HOJAS.HORARIOS]:  ['id', 'docente_id', 'dia', 'tramo_id', 'grupo_ids', 'semana', 'origen'],
  [HOJAS.TRAMOS]:    ['id', 'orden', 'hora_inicio', 'hora_fin', 'etiqueta', 'es_recreo'],
  [HOJAS.GRUPOS]:    ['id', 'nombre_corto', 'nombre_largo', 'orden'],
  [HOJAS.SEMANAS]:   ['id', 'fecha_inicio', 'fecha_fin', 'tipo']
};

const DIAS = ['L', 'M', 'X', 'J', 'V'];
