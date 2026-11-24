const pool = require('../config/db');

const COLUMNS = 'doctor_id, full_name, email, specialty, consultation_fee, room, created_at';

async function findAll(specialty) {
  if (specialty) {
    const [rows] = await pool.execute(
      `SELECT ${COLUMNS} FROM doctors WHERE specialty = ? ORDER BY doctor_id`,
      [specialty],
    );
    return rows;
  }
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM doctors ORDER BY doctor_id`);
  return rows;
}

async function findById(id, conn = pool) {
  const [rows] = await conn.execute(`SELECT ${COLUMNS} FROM doctors WHERE doctor_id = ?`, [id]);
  return rows[0] || null;
}

// locks the doctor row until the transaction ends.
// two bookings for the same doctor have to wait for each other here,
// so the "12 per day" count can't be beaten by two requests at the same time.
async function findByIdForUpdate(conn, id) {
  const [rows] = await conn.execute(`SELECT ${COLUMNS} FROM doctors WHERE doctor_id = ? FOR UPDATE`, [id]);
  return rows[0] || null;
}

async function create({ full_name, email, specialty, consultation_fee, room }) {
  const [result] = await pool.execute(
    'INSERT INTO doctors (full_name, email, specialty, consultation_fee, room) VALUES (?, ?, ?, ?, ?)',
    [full_name.trim(), email.trim().toLowerCase(), specialty.trim(), Number(consultation_fee), room.trim()],
  );
  return findById(result.insertId);
}

async function update(id, fields) {
  const allowed = ['full_name', 'email', 'specialty', 'consultation_fee', 'room'];
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`); // column names come from the allowed list, never from the user
      let value = fields[key];
      if (key === 'consultation_fee') value = Number(value);
      else value = String(value).trim();
      if (key === 'email') value = value.toLowerCase();
      values.push(value);
    }
  }
  values.push(id);
  const [result] = await pool.execute(`UPDATE doctors SET ${sets.join(', ')} WHERE doctor_id = ?`, values);
  if (result.affectedRows === 0) return null;
  return findById(id);
}

async function remove(id) {
  const [result] = await pool.execute('DELETE FROM doctors WHERE doctor_id = ?', [id]);
  return result.affectedRows > 0;
}

// free and taken slots for one day
async function findBookedTimes(doctorId, date) {
  const [rows] = await pool.execute(
    `SELECT TIME_FORMAT(appt_datetime, '%H:%i') AS time
       FROM appointments
      WHERE doctor_id = ? AND status = 'booked' AND DATE(appt_datetime) = ?
      ORDER BY appt_datetime`,
    [doctorId, date],
  );
  return rows.map((r) => r.time);
}

module.exports = { findAll, findById, findByIdForUpdate, create, update, remove, findBookedTimes };
