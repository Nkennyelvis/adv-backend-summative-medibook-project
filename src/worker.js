// Background worker - run it in its own terminal with: npm run worker
// 1. sends (pretends to send) confirmation SMS/email -> writes it to logs/audit.log
// 2. when a slot is freed by a cancellation, books the first patient on the waitlist
const { Worker } = require('bullmq');
const { createWorkerClient } = require('./config/redis');
const { NOTIFICATIONS, WAITLIST, getQueues } = require('./queues');
const { createWaitlist } = require('./queues/waitlist');
const service = require('./services/appointmentService');
const appointmentModel = require('./models/appointmentModel');
const pool = require('./config/db');
const audit = require('./utils/auditLogger');

const redis = createWorkerClient();
const waitlist = createWaitlist(redis);

async function sendConfirmation(job) {
  const d = job.data;
  const message = `Hi ${d.patientName}, your appointment with ${d.doctorName} is confirmed for ${d.datetime} in room ${d.room}.`;
  // no real SMS/email, we just record it
  await audit.append('notification_sent', {
    jobId: job.id,
    appointmentId: d.appointmentId,
    channels: ['sms', 'email'],
    to: { phone: d.patientPhone, email: d.patientEmail },
    message,
  });
  return { sent: true };
}

async function promoteFromWaitlist(job) {
  const { doctorId, date, datetime } = job.data;

  const result = await waitlist.promote({ doctorId, date }, {
    book: async (entry) => {
      const { appointment } = await service.bookAppointment(
        { patientId: entry.patientId, doctorId, datetime },
        { source: 'waitlist' },
      );
      return appointment;
    },
    // if we crashed last time right after booking, the patient may still be in redis
    alreadyBooked: (entry) => appointmentModel.patientHasBookingWithDoctorOnDate(pool, entry.patientId, doctorId, date),
  });

  if (result.promoted) {
    await audit.append('waitlist_promoted', {
      jobId: job.id,
      patientId: result.promoted.entry.patientId,
      doctorId,
      datetime,
      appointmentId: result.promoted.appointment.appointment_id,
    });
  } else {
    await audit.append('waitlist_not_promoted', {
      jobId: job.id, doctorId, datetime, reason: result.stoppedBecause || 'nobody could take the slot',
    });
  }
  for (const entry of result.failed) {
    await audit.append('waitlist_entry_failed', { patientId: entry.patientId, doctorId, date });
  }
  return { promoted: Boolean(result.promoted) };
}

async function start() {
  getQueues(); // used when a promoted patient gets their confirmation job
  const restored = await waitlist.recoverAll();
  if (restored) console.log(`Put ${restored} patient(s) back on the waitlist after a restart`);
  await audit.prepend('worker_started', { restoredWaitlistEntries: restored });

  const notificationWorker = new Worker(NOTIFICATIONS, sendConfirmation, { connection: createWorkerClient() });
  // concurrency 1: one promotion at a time, so two promotions can't fight over the same list
  const waitlistWorker = new Worker(WAITLIST, promoteFromWaitlist, { connection: createWorkerClient(), concurrency: 1 });

  for (const w of [notificationWorker, waitlistWorker]) {
    w.on('completed', (job) => console.log(`[${w.name}] job ${job.id} done`));
    w.on('failed', (job, err) => {
      console.error(`[${w.name}] job ${job && job.id} failed: ${err.message}`);
      audit.append('job_failed', { queue: w.name, jobId: job && job.id, error: err.message });
    });
  }
  console.log('Worker is running and waiting for jobs...');

  const stop = async () => {
    await Promise.all([notificationWorker.close(), waitlistWorker.close()]);
    redis.disconnect();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

start().catch((err) => {
  console.error('Worker could not start:', err.message);
  process.exit(1);
});
