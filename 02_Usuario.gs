/**
 * Identificación: la web app se ejecuta como quien la despliega, con acceso
 * para el dominio, así que Session.getActiveUser() da el email de quien entra.
 * Ese email (o el de su sustituto/a) se cruza con la pestaña Docentes.
 * Administra quien despliega y los docentes marcados con es_admin.
 */
let yoMemo_ = null;
function yo_() {
  if (yoMemo_) return yoMemo_;
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase().trim();
  const duenio = String(Session.getEffectiveUser().getEmail() || '').toLowerCase().trim();
  // Los docentes desactivados no entran.
  const docentes = filas_(HOJAS.DOCENTES).filter(function(d) { return d.activo === '' || si_(d.activo); });
  let docente = null, comoSustituto = false;
  if (email) {
    docente = docentes.filter(function(d) { return String(d.sustituto_email).toLowerCase().trim() === email; })[0] || null;
    comoSustituto = !!docente;
    if (!docente) docente = docentes.filter(function(d) { return String(d.email).toLowerCase().trim() === email; })[0] || null;
  }
  const admin = (!!email && email === duenio) || (!!docente && !comoSustituto && si_(docente.es_admin)) ||
    String(config_().ADMINS || '').toLowerCase().split(/[,;\s]+/).indexOf(email) >= 0 && !!email;
  return (yoMemo_ = {
    email: email,
    docenteId: docente ? docente.id : '',
    comoSustituto: comoSustituto,
    admin: admin
  });
}

/** Docente en cuyo nombre se actúa: el propio, o el elegido si se permite. */
function actorId_(pedido) {
  const yo = yo_();
  if (pedido && yo.admin) return { yo: yo, id: pedido };
  if (!yo.docenteId) throw new Error('No te encuentro entre el profesorado. Pide a la administración que añada tu email.');
  return { yo: yo, id: yo.docenteId };
}

/** Exige ser docente registrado, administración o cuenta sin email. */
function exigirAcceso_() {
  const yo = yo_();
  // Sin email visible no se entra nunca: solo docentes dados de alta y administración.
  if (!yo.email || (!yo.docenteId && !yo.admin)) throw new Error('Tu cuenta (' + yo.email + ') no está entre el profesorado. Pide a la administración que te añada.');
  return yo;
}

function exigirAdmin_() {
  const yo = yo_();
  if (!yo.admin) throw new Error('Solo la administración puede hacer esto.');
  return yo;
}
