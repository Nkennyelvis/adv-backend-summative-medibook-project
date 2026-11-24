const doctorModel = require('../models/doctorModel');
const reportModel = require('../models/reportModel');
const HttpError = require('../utils/httpError');
const { isId, validateDoctor } = require('../utils/validate');
const {
  parseDate, OPEN_HOUR, CLOSE_HOUR, SLOT_MINUTES, MAX_PER_DAY,
} = require('../utils/slots');

function checkId(id) {
  if (!isId(id)) throw new HttpError(400, 'Doctor id must be a positive number');
  return Number(id);
}

async function getAll(req, res) {
  const { specialty } = req.query;
  if (specialty !== undefined && typeof specialty !== 'string') {
    throw new HttpError(400, 'specialty must be text');
  }
  const doctors = await doctorModel.findAll(specialty);
  res.status(200).json(doctors);
}

async function getOne(req, res) {
  const id = checkId(req.params.id);
  const doctor = await doctorModel.findById(id);
  if (!doctor) throw new HttpError(404, `Doctor ${id} not found`);
  res.status(200).json(doctor);
}

async function create(req, res) {
  const errors = validateDoctor(req.body);
  if (errors.length) throw new HttpError(400, 'Validation failed', { details: errors });
  const doctor = await doctorModel.create(req.body);
  res.status(201).location(`/api/doctors/${doctor.doctor_id}`).json(doctor);
}

async function update(req, res) {
  const id = checkId(req.params.id);
  const errors = validateDoctor(req.body, true);
  if (errors.length) throw new HttpError(400, 'Validation failed', { details: errors });
  const doctor = await doctorModel.update(id, req.body);
  if (!doctor) throw new HttpError(404, `Doctor ${id} not found`);
  res.status(200).json(doctor);
}

async function remove(req, res) {
  const id = checkId(req.params.id);
  const deleted = await doctorModel.remove(id);
  if (!deleted) throw new HttpError(404, `Doctor ${id} not found`);
  res.status(204).end();
}

// GET /api/doctors/:id/stats
async function stats(req, res) {
  const id = checkId(req.params.id);
  const result = await reportModel.doctorStats(id);
  if (!result) throw new HttpError(404, `Doctor ${id} not found`);
  res.status(200).json(result);
}

// GET /api/doctors/:id/availability?date=2026-12-01
async function availability(req, res) {
  const id = checkId(req.params.id);
  const date = parseDate(req.query.date);
  if (!date) throw new HttpError(400, 'date query is required, like ?date=2026-12-01');
  const doctor = await doctorModel.findById(id);
  if (!doctor) throw new HttpError(404, `Doctor ${id} not found`);

  const booked = await doctorModel.findBookedTimes(id, req.query.date);
  const slots = [];
  for (let m = OPEN_HOUR * 60; m + SLOT_MINUTES <= CLOSE_HOUR * 60; m += SLOT_MINUTES) {
    const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    slots.push(time);
  }
  const dayFull = booked.length >= MAX_PER_DAY;
  res.status(200).json({
    doctor_id: id,
    date: req.query.date,
    booked_count: booked.length,
    day_full: dayFull,
    booked,
    free: dayFull ? [] : slots.filter((t) => !booked.includes(t)),
  });
}

module.exports = {
  getAll, getOne, create, update, remove, stats, availability,
};
