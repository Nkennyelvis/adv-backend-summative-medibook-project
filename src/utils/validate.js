// simple validation helpers, they return a list of error messages
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+\-\s()]{7,20}$/;

function isText(v, max) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
}

function isId(v) {
  return /^\d+$/.test(String(v)) && Number(v) > 0 && Number(v) <= 4294967295;
}

function isEmail(v) {
  return typeof v === 'string' && v.length <= 150 && EMAIL.test(v);
}

// partial = true is used for PATCH (only check the fields that were sent)
function validatePatient(body, partial = false) {
  const errors = [];
  const b = body || {};
  const has = (k) => b[k] !== undefined;
  if (!partial || has('full_name')) {
    if (!isText(b.full_name, 100)) errors.push('full_name is required (max 100 characters)');
  }
  if (!partial || has('email')) {
    if (!isEmail(b.email)) errors.push('email must be a valid email address');
  }
  if (!partial || has('phone')) {
    if (typeof b.phone !== 'string' || !PHONE.test(b.phone)) errors.push('phone must be 7-20 digits');
  }
  if (has('date_of_birth') && b.date_of_birth !== null) {
    const d = new Date(b.date_of_birth);
    const ok = typeof b.date_of_birth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date_of_birth)
      && !Number.isNaN(d.getTime()) && d < new Date();
    if (!ok) errors.push('date_of_birth must be a past date like 1995-04-30');
  }
  if (partial && !['full_name', 'email', 'phone', 'date_of_birth'].some(has)) {
    errors.push('Send at least one field to update');
  }
  return errors;
}

function validateDoctor(body, partial = false) {
  const errors = [];
  const b = body || {};
  const has = (k) => b[k] !== undefined;
  if (!partial || has('full_name')) {
    if (!isText(b.full_name, 100)) errors.push('full_name is required (max 100 characters)');
  }
  if (!partial || has('email')) {
    if (!isEmail(b.email)) errors.push('email must be a valid email address');
  }
  if (!partial || has('specialty')) {
    if (!isText(b.specialty, 80)) errors.push('specialty is required (max 80 characters)');
  }
  if (!partial || has('consultation_fee')) {
    const fee = Number(b.consultation_fee);
    if (b.consultation_fee === null || b.consultation_fee === '' || typeof b.consultation_fee === 'boolean'
      || !Number.isFinite(fee) || fee <= 0 || fee > 99999999) {
      errors.push('consultation_fee must be a number greater than 0');
    }
  }
  if (!partial || has('room')) {
    if (!isText(b.room, 10)) errors.push('room is required (max 10 characters)');
  }
  if (partial && !['full_name', 'email', 'specialty', 'consultation_fee', 'room'].some(has)) {
    errors.push('Send at least one field to update');
  }
  return errors;
}

module.exports = { isId, validatePatient, validateDoctor };
