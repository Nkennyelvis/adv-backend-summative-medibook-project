const pool = require('../config/db');

const SELECT_DETAILS = `
  SELECT a.appointment_id, a.appt_datetime, a.status, a.amount_paid, a.booked_on,
         a.cancelled_at, a.refund_percent, a.refund_amount,
         p.patient_id, p.full_name AS patient_name, p.email AS patient_email, p.phone AS patient_phone,
         d.doctor_id, d.full_name AS doctor_name, d.specialty, d.room
    FROM appointments a
    JOIN patients p ON p.patient_id = a.patient_id
    JOIN doctors d  ON d.doctor_id  = a.doctor_id`;

async function findById(id, conn = pool) {
  const [rows] = await conn.execute(`${SELECT_DETAILS} WHERE a.appointment_id = ?`, [id]);
  return rows[0] || null;
}

// filters are optional. only fixed SQL pieces are added, the values go in as ? params
async function findAll({ doctorId, patientId, status, date } = {}) {
  const where = [];
  const params = [];
  if (doctorId) { where.push('a.doctor_id = ?'); params.push(doctorId); }
  if (patientId) { where.push('a.patient_id = ?'); params.push(patientId); }
  if (status) { where.push('a.status = ?'); params.push(status); }
  if (date) { where.push('DATE(a.appt_datetime) = ?'); params.push(date); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.execute(`${SELECT_DETAILS} ${whereSql} ORDER BY a.appt_datetime`, params);
  return rows;
}

async function countActiveForDoctorOnDate(conn, doctorId, date) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS total FROM appointments
      WHERE doctor_id = ? AND status = 'booked' AND DATE(appt_datetime) = ?`,
    [doctorId, date],
  );
  return rows[0].total;
}

async function isSlotTaken(conn, doctorId, datetime) {
  const [rows] = await conn.execute(
    "SELECT appointment_id FROM appointments WHERE doctor_id = ? AND appt_datetime = ? AND status = 'booked'",
    [doctorId, datetime],
  );
  return rows.length > 0;
}

// a patient can't be in two places at once
async function patientHasClash(conn, patientId, datetime) {
  const [rows] = await conn.execute(
    "SELECT appointment_id FROM appointments WHERE patient_id = ? AND appt_datetime = ? AND status = 'booked'",
    [patientId, datetime],
  );
  return rows.length > 0;
}

async function patientHasBookingWithDoctorOnDate(conn, patientId, doctorId, date) {
  const [rows] = await conn.execute(
    `SELECT appointment_id FROM appointments
      WHERE patient_id = ? AND doctor_id = ? AND DATE(appt_datetime) = ? AND status = 'booked'`,
    [patientId, doctorId, date],
  );
  return rows.length > 0;
}

async function insert(conn, { patientId, doctorId, datetime, amountPaid }) {
  const [result] = await conn.execute(
    'INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid) VALUES (?, ?, ?, ?)',
    [patientId, doctorId, datetime, amountPaid],
  );
  return result.insertId;
}

async function findByIdForUpdate(conn, id) {
  const [rows] = await conn.execute(
    'SELECT appointment_id, patient_id, doctor_id, appt_datetime, status, amount_paid FROM appointments WHERE appointment_id = ? FOR UPDATE',
    [id],
  );
  return rows[0] || null;
}

// cancelling and saving the refund is one UPDATE inside the transaction
async function markCancelled(conn, id, { percent, amount }) {
  const [result] = await conn.execute(
    `UPDATE appointments
        SET status = 'cancelled', cancelled_at = NOW(), refund_percent = ?, refund_amount = ?
      WHERE appointment_id = ? AND status = 'booked'`,
    [percent, amount, id],
  );
  return result.affectedRows === 1;
}

module.exports = {
  findById,
  findAll,
  countActiveForDoctorOnDate,
  isSlotTaken,
  patientHasClash,
  patientHasBookingWithDoctorOnDate,
  insert,
  findByIdForUpdate,
  markCancelled,
};
