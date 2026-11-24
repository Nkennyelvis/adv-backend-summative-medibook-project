const appointmentModel = require('../models/appointmentModel');
const doctorModel = require('../models/doctorModel');
const patientModel = require('../models/patientModel');
const service = require('../services/appointmentService');
const queues = require('../queues');
const HttpError = require('../utils/httpError');
const { isId } = require('../utils/validate');
const { parseDate, toSqlDate } = require('../utils/slots');

function checkId(id, name = 'Appointment id') {
  if (!isId(id)) throw new HttpError(400, `${name} must be a positive number`);
  return Number(id);
}

// GET /api/appointments?doctor_id=1&patient_id=2&status=booked&date=2026-12-01
async function getAll(req, res) {
  const filters = {};
  const q = req.query;
  if (q.doctor_id !== undefined) filters.doctorId = checkId(q.doctor_id, 'doctor_id');
  if (q.patient_id !== undefined) filters.patientId = checkId(q.patient_id, 'patient_id');
  if (q.status !== undefined) {
    if (!['booked', 'cancelled'].includes(q.status)) throw new HttpError(400, 'status must be booked or cancelled');
    filters.status = q.status;
  }
  if (q.date !== undefined) {
    if (!parseDate(q.date)) throw new HttpError(400, 'date must look like 2026-12-01');
    filters.date = q.date;
  }
  const appointments = await appointmentModel.findAll(filters);
  res.status(200).json(appointments);
}

async function getOne(req, res) {
  const id = checkId(req.params.id);
  const appointment = await appointmentModel.findById(id);
  if (!appointment) throw new HttpError(404, `Appointment ${id} not found`);
  res.status(200).json(appointment);
}

// POST /api/appointments  { patient_id, doctor_id, datetime: "2026-12-01 09:30" }
async function book(req, res) {
  const b = req.body || {};
  const errors = [];
  if (!isId(b.patient_id)) errors.push('patient_id is required and must be a positive number');
  if (!isId(b.doctor_id)) errors.push('doctor_id is required and must be a positive number');
  if (typeof b.datetime !== 'string') errors.push('datetime is required, like "2026-12-01 09:30"');
  if (errors.length) throw new HttpError(400, 'Validation failed', { details: errors });

  const { appointment, notificationQueued } = await service.bookAppointment({
    patientId: Number(b.patient_id),
    doctorId: Number(b.doctor_id),
    datetime: b.datetime,
  });

  res.status(201).location(`/api/appointments/${appointment.appointment_id}`).json({
    message: 'Appointment booked',
    appointment,
    notification_queued: notificationQueued,
  });
}

// PATCH /api/appointments/:id/cancel
async function cancel(req, res) {
  const id = checkId(req.params.id);
  const { appointment, refund, waitlistNotified } = await service.cancelAppointment(id);
  res.status(200).json({
    message: `Appointment cancelled. Refund: ${refund.amount.toFixed(2)} (${refund.percent}%)`,
    refund: {
      hours_notice: refund.hoursNotice,
      percent: refund.percent,
      amount: refund.amount,
    },
    appointment,
    waitlist_notified: waitlistNotified,
  });
}

// ---------- waitlist ----------

function readWaitlistBody(body) {
  const b = body || {};
  const errors = [];
  if (!isId(b.patient_id)) errors.push('patient_id is required and must be a positive number');
  if (!isId(b.doctor_id)) errors.push('doctor_id is required and must be a positive number');
  const day = parseDate(b.date);
  if (!day) errors.push('date is required, like "2026-12-01"');
  if (errors.length) throw new HttpError(400, 'Validation failed', { details: errors });
  return { patientId: Number(b.patient_id), doctorId: Number(b.doctor_id), date: b.date, day };
}

function redisDown(err) {
  return new HttpError(503, 'Waitlist is not available right now (Redis is down)', { code: 'REDIS_DOWN', cause: err.message });
}

// POST /api/waitlist  { patient_id, doctor_id, date }
async function joinWaitlist(req, res) {
  const { patientId, doctorId, date, day } = readWaitlistBody(req.body);
  if (date < toSqlDate(new Date())) throw new HttpError(422, 'You cannot join the waitlist for a past date');

  const [patient, doctor] = await Promise.all([patientModel.findById(patientId), doctorModel.findById(doctorId)]);
  if (!patient) throw new HttpError(404, `Patient ${patientId} not found`);
  if (!doctor) throw new HttpError(404, `Doctor ${doctorId} not found`);

  let position;
  try {
    position = await queues.waitlist().join({ patientId, doctorId, date: toSqlDate(day) });
  } catch (err) {
    throw redisDown(err);
  }
  if (position === null) throw new HttpError(409, 'This patient is already on the waitlist for that day');

  res.status(201).json({
    message: `Added to the waitlist for ${doctor.full_name} on ${date}`,
    position,
  });
}

// GET /api/waitlist?doctor_id=1&date=2026-12-01
async function getWaitlist(req, res) {
  const doctorId = checkId(req.query.doctor_id, 'doctor_id');
  if (!parseDate(req.query.date)) throw new HttpError(400, 'date query is required, like ?date=2026-12-01');
  let entries;
  try {
    entries = await queues.waitlist().list(doctorId, req.query.date);
  } catch (err) {
    throw redisDown(err);
  }
  res.status(200).json(entries.map((e, i) => ({ position: i + 1, ...e })));
}

// DELETE /api/waitlist  { patient_id, doctor_id, date }
async function leaveWaitlist(req, res) {
  const { patientId, doctorId, date } = readWaitlistBody(req.body);
  let removed;
  try {
    removed = await queues.waitlist().leave({ patientId, doctorId, date });
  } catch (err) {
    throw redisDown(err);
  }
  if (!removed) throw new HttpError(404, 'That patient is not on this waitlist');
  res.status(204).end();
}

module.exports = {
  getAll, getOne, book, cancel, joinWaitlist, getWaitlist, leaveWaitlist,
};
