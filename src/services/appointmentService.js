// booking and cancelling rules. used by the appointment controller AND by the worker
// (when someone is moved off the waitlist), so the rules are only written once.
const { withTransaction } = require('../models/transaction');
const appointmentModel = require('../models/appointmentModel');
const doctorModel = require('../models/doctorModel');
const patientModel = require('../models/patientModel');
const queues = require('../queues');
const audit = require('../utils/auditLogger');
const HttpError = require('../utils/httpError');
const { calculateRefund } = require('../utils/refund');
const {
  MAX_PER_DAY, parseDateTime, checkSlot, toSqlDateTime, toSqlDate,
} = require('../utils/slots');

async function bookAppointment({ patientId, doctorId, datetime }, { source = 'api' } = {}) {
  const date = parseDateTime(datetime);
  if (!date) throw new HttpError(400, 'datetime must look like 2026-12-01 09:30', { code: 'BAD_DATETIME' });
  const slotError = checkSlot(date);
  if (slotError) {
    const code = slotError.includes('future') ? 'SLOT_IN_PAST' : 'INVALID_SLOT';
    throw new HttpError(422, slotError, { code });
  }

  const sqlDateTime = toSqlDateTime(date);
  const day = toSqlDate(date);

  let appointmentId;
  try {
    appointmentId = await withTransaction(async (conn) => {
      // lock the doctor first so bookings for this doctor happen one at a time
      const doctor = await doctorModel.findByIdForUpdate(conn, doctorId);
      if (!doctor) throw new HttpError(404, `Doctor ${doctorId} not found`, { code: 'DOCTOR_NOT_FOUND' });

      const patient = await patientModel.findById(patientId, conn);
      if (!patient) throw new HttpError(404, `Patient ${patientId} not found`, { code: 'PATIENT_NOT_FOUND' });

      const bookedToday = await appointmentModel.countActiveForDoctorOnDate(conn, doctorId, day);
      if (bookedToday >= MAX_PER_DAY) {
        throw new HttpError(409, `${doctor.full_name} already has ${MAX_PER_DAY} appointments on ${day}`, {
          code: 'DAY_FULL', waitlist: { available: true, doctorId, date: day },
        });
      }

      if (await appointmentModel.isSlotTaken(conn, doctorId, sqlDateTime)) {
        throw new HttpError(409, `The ${sqlDateTime.slice(11, 16)} slot with ${doctor.full_name} is already taken`, {
          code: 'SLOT_TAKEN', waitlist: { available: true, doctorId, date: day },
        });
      }

      if (await appointmentModel.patientHasClash(conn, patientId, sqlDateTime)) {
        throw new HttpError(409, 'This patient already has another appointment at that time', { code: 'PATIENT_CLASH' });
      }

      // the fee is copied into amount_paid because the doctor's fee can change later
      return appointmentModel.insert(conn, {
        patientId, doctorId, datetime: sqlDateTime, amountPaid: doctor.consultation_fee,
      });
    });
  } catch (err) {
    // the UNIQUE (doctor_id, active_slot) key is the last safety net if two requests still race
    if (err.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'That slot was just taken by someone else', {
        code: 'SLOT_TAKEN', waitlist: { available: true, doctorId, date: day },
      });
    }
    throw err;
  }

  const appointment = await appointmentModel.findById(appointmentId);

  audit.append('appointment_booked', {
    appointmentId, patientId, doctorId, datetime: sqlDateTime, amountPaid: appointment.amount_paid, source,
  });

  // the confirmation is sent by the worker. if redis is down the booking still counts.
  let notificationQueued = true;
  try {
    await queues.addNotificationJob(appointment);
  } catch (err) {
    notificationQueued = false;
    audit.append('notification_not_queued', { appointmentId, error: err.message });
  }

  return { appointment, notificationQueued };
}

async function cancelAppointment(appointmentId) {
  const result = await withTransaction(async (conn) => {
    const appt = await appointmentModel.findByIdForUpdate(conn, appointmentId);
    if (!appt) throw new HttpError(404, `Appointment ${appointmentId} not found`);
    if (appt.status === 'cancelled') throw new HttpError(409, 'This appointment is already cancelled');

    const apptTime = parseDateTime(appt.appt_datetime);
    if (apptTime <= new Date()) {
      throw new HttpError(422, 'Appointments in the past cannot be cancelled');
    }

    // refund is worked out on the server from how much notice was given
    const refund = calculateRefund(appt.amount_paid, apptTime, new Date());

    const updated = await appointmentModel.markCancelled(conn, appointmentId, refund);
    if (!updated) throw new HttpError(409, 'This appointment is already cancelled');

    return { appt, refund };
  });

  const { appt, refund } = result;
  const appointment = await appointmentModel.findById(appointmentId);

  audit.append('appointment_cancelled', {
    appointmentId,
    patientId: appt.patient_id,
    doctorId: appt.doctor_id,
    datetime: appt.appt_datetime,
    hoursNotice: refund.hoursNotice,
    refundPercent: refund.percent,
    refundAmount: refund.amount,
  });

  // tell the worker a slot is free so it can book the first person on the waitlist
  let waitlistNotified = true;
  try {
    await queues.addWaitlistJob({
      doctorId: appt.doctor_id,
      date: appt.appt_datetime.slice(0, 10),
      datetime: appt.appt_datetime,
      cancelledAppointmentId: appointmentId,
    });
  } catch (err) {
    waitlistNotified = false;
    audit.append('waitlist_job_not_queued', { appointmentId, error: err.message });
  }

  return { appointment, refund, waitlistNotified };
}

module.exports = { bookAppointment, cancelAppointment };
