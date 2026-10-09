/**
 * Identificación: la web app se ejecuta como quien la despliega, con acceso
 * para el dominio, así que Session.getActiveUser() da el email de quien entra.
 * Ese email (o el de su sustituto/a) se cruza con la pestaña Docentes.
 * Administra quien despliega y los docentes marcados con es_admin.
 */
function _yo() {
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase().trim();
  const duenio = String(Session.getEffectiveUser().getEmail() || '').toLowerCase().trim();
  const docentes = _filas(HOJAS.DOCENTES);
  let docente = null, comoSustituto = false;
  if (email) {
    docente = docentes.filter(function(d) { return String(d.sustituto_email).toLowerCase().trim() === email; })[0] || null;
    comoSustituto = !!docente;
    if (!docente) docente = docentes.filter(function(d) { return String(d.email).toLowerCase().trim() === email; })[0] || null;
  }
  const admin = (!!email && email === duenio) || (!!docente && !comoSustituto && _si(docente.es_admin)) ||
    String(_config().ADMINS || '').toLowerCase().split(/[,;\s]+/).indexOf(email) >= 0 && !!email;
  return {
    email: email,
    docenteId: docente ? docente.id : '',
    comoSustituto: comoSustituto,
    admin: admin,
    // Sin email resoluble (cuenta ajena al dominio): se deja elegir docente.
    elegible: !docente
  };
}

/** Docente en cuyo nombre se actúa: el propio, o el elegido si se permite. */
function _actorId(pedido) {
  const yo = _yo();
  if (pedido && (yo.admin || yo.elegible)) return { yo: yo, id: pedido };
  if (!yo.docenteId) throw new Error('No te encuentro entre el profesorado. Pide a la administración que añada tu email.');
  return { yo: yo, id: yo.docenteId };
}

function _exigirAdmin() {
  const yo = _yo();
  if (!yo.admin) throw new Error('Solo la administración puede hacer esto.');
  return yo;
}
