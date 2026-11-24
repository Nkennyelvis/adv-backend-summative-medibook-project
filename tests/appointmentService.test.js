// booking/cancel rules with the models and queues mocked (no MySQL or Redis needed)
jest.mock('../src/config/db', () => ({}));
jest.mock('../src/models/transaction', () => ({ withTransaction: jest.fn((fn) => fn({})) }));
jest.mock('../src/models/appointmentModel');
jest.mock('../src/models/doctorModel');
jest.mock('../src/models/patientModel');
jest.mock('../src/queues', () => ({ addNotificationJob: jest.fn(), addWaitlistJob: jest.fn() }));
jest.mock('../src/utils/auditLogger', () => ({ append: jest.fn(), prepend: jest.fn() }));

const appointmentModel = require('../src/models/appointmentModel');
const doctorModel = require('../src/models/doctorModel');
const patientModel = require('../src/models/patientModel');
const queues = require('../src/queues');
const audit = require('../src/utils/auditLogger');
const { bookAppointment, cancelAppointment } = require('../src/services/appointmentService');

const pad = (n) => String(n).padStart(2, '0');
function daysFromNow(days, time) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`;
}

const doctor = { doctor_id: 1, full_name: 'Dr. Boateng', consultation_fee: 150 };
const patient = { patient_id: 2, full_name: 'Kojo Owusu' };

beforeEach(() => {
  jest.clearAllMocks();
  doctorModel.findByIdForUpdate.mockResolvedValue(doctor);
  patientModel.findById.mockResolvedValue(patient);
  appointmentModel.countActiveForDoctorOnDate.mockResolvedValue(3);
  appointmentModel.isSlotTaken.mockResolvedValue(false);
  appointmentModel.patientHasClash.mockResolvedValue(false);
  appointmentModel.insert.mockResolvedValue(50);
  appointmentModel.findById.mockResolvedValue({ appointment_id: 50, amount_paid: 150 });
  queues.addNotificationJob.mockResolvedValue({ id: '1' });
});

describe('bookAppointment', () => {
  const request = () => ({ patientId: 2, doctorId: 1, datetime: daysFromNow(3, '10:00') });

  test('books, charges the doctor fee, logs it and queues a notification', async () => {
    const { appointment, notificationQueued } = await bookAppointment(request());
    expect(appointment.appointment_id).toBe(50);
    expect(appointmentModel.insert).toHaveBeenCalledWith({}, expect.objectContaining({ amountPaid: 150 }));
    expect(audit.append).toHaveBeenCalledWith('appointment_booked', expect.any(Object));
    expect(queues.addNotificationJob).toHaveBeenCalled();
    expect(notificationQueued).toBe(true);
  });

  test('the 13th booking of the day is refused with 409 and a waitlist offer', async () => {
    appointmentModel.countActiveForDoctorOnDate.mockResolvedValue(12);
    await expect(bookAppointment(request())).rejects.toMatchObject({
      status: 409, code: 'DAY_FULL', extra: { waitlist: { available: true } },
    });
    expect(appointmentModel.insert).not.toHaveBeenCalled();
  });

  test('the 12th booking of the day is still allowed', async () => {
    appointmentModel.countActiveForDoctorOnDate.mockResolvedValue(11);
    await expect(bookAppointment(request())).resolves.toBeDefined();
  });

  test('a taken slot gives 409 SLOT_TAKEN', async () => {
    appointmentModel.isSlotTaken.mockResolvedValue(true);
    await expect(bookAppointment(request())).rejects.toMatchObject({ status: 409, code: 'SLOT_TAKEN' });
  });

  test('if two requests race, the UNIQUE key error becomes a 409', async () => {
    appointmentModel.insert.mockRejectedValue(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
    await expect(bookAppointment(request())).rejects.toMatchObject({ status: 409, code: 'SLOT_TAKEN' });
  });

  test('unknown doctor or patient gives 404', async () => {
    doctorModel.findByIdForUpdate.mockResolvedValue(null);
    await expect(bookAppointment(request())).rejects.toMatchObject({ status: 404, code: 'DOCTOR_NOT_FOUND' });
    doctorModel.findByIdForUpdate.mockResolvedValue(doctor);
    patientModel.findById.mockResolvedValue(null);
    await expect(bookAppointment(request())).rejects.toMatchObject({ status: 404, code: 'PATIENT_NOT_FOUND' });
  });

  test('bad times are refused before touching the database', async () => {
    await expect(bookAppointment({ ...request(), datetime: 'next monday' })).rejects.toMatchObject({ status: 400 });
    await expect(bookAppointment({ ...request(), datetime: daysFromNow(3, '17:00') })).rejects.toMatchObject({ status: 422 });
    await expect(bookAppointment({ ...request(), datetime: daysFromNow(-1, '10:00') })).rejects.toMatchObject({ status: 422, code: 'SLOT_IN_PAST' });
    expect(doctorModel.findByIdForUpdate).not.toHaveBeenCalled();
  });

  test('booking still works if redis is down', async () => {
    queues.addNotificationJob.mockRejectedValue(new Error('Stream isn\'t writeable'));
    const { notificationQueued } = await bookAppointment(request());
    expect(notificationQueued).toBe(false);
  });
});

describe('cancelAppointment', () => {
  function existing(datetime, status = 'booked') {
    appointmentModel.findByIdForUpdate.mockResolvedValue({
      appointment_id: 7, patient_id: 2, doctor_id: 1, appt_datetime: datetime, status, amount_paid: 150,
    });
    appointmentModel.markCancelled.mockResolvedValue(true);
  }

  test('5 days notice gives a full refund and tells the waitlist', async () => {
    existing(daysFromNow(5, '10:00:00'));
    const { refund } = await cancelAppointment(7);
    expect(refund).toMatchObject({ percent: 100, amount: 150 });
    expect(appointmentModel.markCancelled).toHaveBeenCalledWith({}, 7, expect.objectContaining({ percent: 100 }));
    expect(queues.addWaitlistJob).toHaveBeenCalledWith(expect.objectContaining({ doctorId: 1 }));
  });

  test('already cancelled gives 409', async () => {
    existing(daysFromNow(5, '10:00:00'), 'cancelled');
    await expect(cancelAppointment(7)).rejects.toMatchObject({ status: 409 });
  });

  test('missing appointment gives 404', async () => {
    appointmentModel.findByIdForUpdate.mockResolvedValue(null);
    await expect(cancelAppointment(999)).rejects.toMatchObject({ status: 404 });
  });

  test('past appointment gives 422', async () => {
    existing(daysFromNow(-2, '10:00:00'));
    await expect(cancelAppointment(7)).rejects.toMatchObject({ status: 422 });
    expect(appointmentModel.markCancelled).not.toHaveBeenCalled();
  });
});
