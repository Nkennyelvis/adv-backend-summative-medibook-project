const reportModel = require('../models/reportModel');

// GET /api/reports/doctors
async function doctors(req, res) {
  const rows = await reportModel.doctorsReport();
  res.status(200).json(rows);
}

// GET /api/reports/busy-days
async function busyDays(req, res) {
  const rows = await reportModel.busyDays();
  res.status(200).json(rows);
}

module.exports = { doctors, busyDays };
