const pool = require('../config/db');
const { MAX_PER_DAY } = require('../utils/slots');

// revenue = what was paid minus what was refunded
async function doctorStats(doctorId) {
  const [summary] = await pool.execute(
    `SELECT d.doctor_id, d.full_name, d.specialty,
            COALESCE(SUM(a.amount_paid - COALESCE(a.refund_amount, 0)), 0) AS revenue_collected,
            COUNT(CASE WHEN a.status = 'booked' AND a.appt_datetime > NOW() THEN 1 END) AS upcoming_appointments
       FROM doctors d
       LEFT JOIN appointments a ON a.doctor_id = d.doctor_id
      WHERE d.doctor_id = ?
      GROUP BY d.doctor_id, d.full_name, d.specialty`,
    [doctorId],
  );
  if (!summary[0]) return null;

  // a recursive CTE makes the 7 dates, so days with 0 appointments still show up
  const [days] = await pool.execute(
    `WITH RECURSIVE next_days AS (
        SELECT CURDATE() AS day, 0 AS n
        UNION ALL
        SELECT day + INTERVAL 1 DAY, n + 1 FROM next_days WHERE n < 6
     )
     SELECT DATE_FORMAT(nd.day, '%Y-%m-%d') AS date,
            COUNT(a.appointment_id) AS appointments,
            ROUND(COUNT(a.appointment_id) / ? * 100, 1) AS utilization_percent
       FROM next_days nd
       LEFT JOIN appointments a
              ON a.doctor_id = ? AND a.status = 'booked' AND DATE(a.appt_datetime) = nd.day
      GROUP BY nd.day
      ORDER BY nd.day`,
    [MAX_PER_DAY, doctorId],
  );

  const [overall] = await pool.execute(
    `SELECT ROUND(COUNT(*) / (? * 7) * 100, 1) AS utilization_percent
       FROM appointments
      WHERE doctor_id = ? AND status = 'booked'
        AND appt_datetime >= CURDATE() AND appt_datetime < CURDATE() + INTERVAL 7 DAY`,
    [MAX_PER_DAY, doctorId],
  );

  return {
    ...summary[0],
    daily_capacity: MAX_PER_DAY,
    next_7_days: days,
    next_7_days_utilization_percent: overall[0].utilization_percent,
  };
}

// LEFT JOIN so doctors with no appointments still appear with 0
async function doctorsReport() {
  const [rows] = await pool.execute(
    `SELECT d.doctor_id, d.full_name, d.specialty,
            COUNT(CASE WHEN a.status = 'booked' THEN 1 END)    AS total_appointments,
            COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) AS cancelled_appointments,
            COALESCE(SUM(a.amount_paid - COALESCE(a.refund_amount, 0)), 0) AS revenue_collected,
            COALESCE(SUM(a.refund_amount), 0) AS refunds_paid
       FROM doctors d
       LEFT JOIN appointments a ON a.doctor_id = d.doctor_id
      GROUP BY d.doctor_id, d.full_name, d.specialty
      ORDER BY revenue_collected DESC, d.doctor_id`,
  );
  return rows;
}

// days where a doctor has more than 80% of the 12 slots booked (so 10 or more)
async function busyDays() {
  const [rows] = await pool.execute(
    `SELECT d.doctor_id, d.full_name, d.specialty,
            DATE_FORMAT(a.appt_datetime, '%Y-%m-%d') AS day,
            COUNT(*) AS booked,
            ROUND(COUNT(*) / ? * 100, 1) AS utilization_percent
       FROM appointments a
       JOIN doctors d ON d.doctor_id = a.doctor_id
      WHERE a.status = 'booked'
      GROUP BY d.doctor_id, d.full_name, d.specialty, day
     HAVING COUNT(*) > ? * 0.8
      ORDER BY day, d.doctor_id`,
    [MAX_PER_DAY, MAX_PER_DAY],
  );
  return rows;
}

module.exports = { doctorStats, doctorsReport, busyDays };
