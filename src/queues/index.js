// the web server uses this file to put jobs on the queues and to use the waitlist.
// the actual work is done by src/worker.js (a separate process)
const { Queue } = require('bullmq');
const { createClient } = require('../config/redis');
const { createWaitlist } = require('./waitlist');

const NOTIFICATIONS = 'notifications';
const WAITLIST = 'waitlist-promotions';

let redis;
let notificationQueue;
let waitlistQueue;

function getRedis() {
  if (!redis) redis = createClient();
  return redis;
}

function getQueues() {
  if (!notificationQueue) {
    const connection = getRedis();
    notificationQueue = new Queue(NOTIFICATIONS, { connection });
    waitlistQueue = new Queue(WAITLIST, { connection });
  }
  return { notificationQueue, waitlistQueue };
}

const jobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

async function addNotificationJob(appointment) {
  const { notificationQueue: q } = getQueues();
  return q.add('appointment-confirmed', {
    appointmentId: appointment.appointment_id,
    patientName: appointment.patient_name,
    patientEmail: appointment.patient_email,
    patientPhone: appointment.patient_phone,
    doctorName: appointment.doctor_name,
    room: appointment.room,
    datetime: appointment.appt_datetime,
  }, jobOptions);
}

async function addWaitlistJob({ doctorId, date, datetime, cancelledAppointmentId }) {
  const { waitlistQueue: q } = getQueues();
  return q.add('slot-freed', { doctorId, date, datetime, cancelledAppointmentId }, jobOptions);
}

function waitlist() {
  return createWaitlist(getRedis());
}

async function close() {
  if (notificationQueue) await Promise.all([notificationQueue.close(), waitlistQueue.close()]);
  if (redis) redis.disconnect();
}

module.exports = {
  NOTIFICATIONS, WAITLIST, addNotificationJob, addWaitlistJob, waitlist, getRedis, getQueues, close,
};
