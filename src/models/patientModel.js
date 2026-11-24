const pool = require('../config/db');

const COLUMNS = 'patient_id, full_name, email, phone, date_of_birth, created_at';

async function findAll() {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM patients ORDER BY patient_id`);
  return rows;
}

async function findById(id, conn = pool) {
  const [rows] = await conn.execute(`SELECT ${COLUMNS} FROM patients WHERE patient_id = ?`, [id]);
  return rows[0] || null;
}

async function create({ full_name, email, phone, date_of_birth }) {
  const [result] = await pool.execute(
    'INSERT INTO patients (full_name, email, phone, date_of_birth) VALUES (?, ?, ?, ?)',
    [full_name.trim(), email.trim().toLowerCase(), phone.trim(), date_of_birth || null],
  );
  return findById(result.insertId);
}

// only updates the fields that were sent
async function update(id, fields) {
  const allowed = ['full_name', 'email', 'phone', 'date_of_birth'];
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`); // column names come from the allowed list, never from the user
      let value = fields[key];
      if (typeof value === 'string') value = value.trim();
      if (key === 'email') value = value.toLowerCase();
      values.push(value);
    }
  }
  values.push(id);
  const [result] = await pool.execute(`UPDATE patients SET ${sets.join(', ')} WHERE patient_id = ?`, values);
  if (result.affectedRows === 0) return null;
  return findById(id);
}

async function remove(id) {
  const [result] = await pool.execute('DELETE FROM patients WHERE patient_id = ?', [id]);
  return result.affectedRows > 0;
}

async function findAppointments(id) {
  const [rows] = await pool.execute(
    `SELECT a.appointment_id, a.appt_datetime, a.status, a.amount_paid, a.refund_amount,
            d.doctor_id, d.full_name AS doctor_name, d.specialty, d.room
       FROM appointments a
       JOIN doctors d ON d.doctor_id = a.doctor_id
      WHERE a.patient_id = ?
      ORDER BY a.appt_datetime`,
    [id],
  );
  return rows;
}

module.exports = { findAll, findById, create, update, remove, findAppointments };
