const patientModel = require('../models/patientModel');
const HttpError = require('../utils/httpError');
const { isId, validatePatient } = require('../utils/validate');

function checkId(id) {
  if (!isId(id)) throw new HttpError(400, 'Patient id must be a positive number');
  return Number(id);
}

async function getAll(req, res) {
  const patients = await patientModel.findAll();
  res.status(200).json(patients);
}

async function getOne(req, res) {
  const id = checkId(req.params.id);
  const patient = await patientModel.findById(id);
  if (!patient) throw new HttpError(404, `Patient ${id} not found`);
  res.status(200).json(patient);
}

async function create(req, res) {
  const errors = validatePatient(req.body);
  if (errors.length) throw new HttpError(400, 'Validation failed', { details: errors });
  const patient = await patientModel.create(req.body);
  res.status(201).location(`/api/patients/${patient.patient_id}`).json(patient);
}

async function update(req, res) {
  const id = checkId(req.params.id);
  const errors = validatePatient(req.body, true);
  if (errors.length) throw new HttpError(400, 'Validation failed', { details: errors });
  const patient = await patientModel.update(id, req.body);
  if (!patient) throw new HttpError(404, `Patient ${id} not found`);
  res.status(200).json(patient);
}

async function remove(req, res) {
  const id = checkId(req.params.id);
  const deleted = await patientModel.remove(id);
  if (!deleted) throw new HttpError(404, `Patient ${id} not found`);
  res.status(204).end();
}

async function getAppointments(req, res) {
  const id = checkId(req.params.id);
  const patient = await patientModel.findById(id);
  if (!patient) throw new HttpError(404, `Patient ${id} not found`);
  const appointments = await patientModel.findAppointments(id);
  res.status(200).json(appointments);
}

module.exports = { getAll, getOne, create, update, remove, getAppointments };
