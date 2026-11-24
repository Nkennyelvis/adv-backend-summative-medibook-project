// tests the waitlist with a tiny fake redis (no real redis needed)
const { createWaitlist, listKey, FAILED_KEY } = require('../src/queues/waitlist');
const HttpError = require('../src/utils/httpError');

function fakeRedis() {
  const data = {};
  const get = (k) => { if (!data[k]) data[k] = []; return data[k]; };
  return {
    data,
    async rpush(k, v) { return get(k).push(v); },
    async lpush(k, v) { get(k).unshift(v); return get(k).length; },
    async lrange(k) { return [...get(k)]; },
    async llen(k) { return get(k).length; },
    async lrem(k, count, v) {
      const i = get(k).indexOf(v);
      if (i === -1) return 0;
      get(k).splice(i, 1);
      return 1;
    },
    async lmove(src, dst, from, to) {
      const list = get(src);
      if (!list.length) return null;
      const v = from === 'LEFT' ? list.shift() : list.pop();
      if (to === 'LEFT') get(dst).unshift(v); else get(dst).push(v);
      return v;
    },
    async scan() {
      return ['0', Object.keys(data).filter((k) => k.endsWith(':processing') && data[k].length)];
    },
  };
}

const DAY = '2026-12-10';
const ids = async (wl) => (await wl.list(1, DAY)).map((e) => e.patientId);

describe('waitlist', () => {
  let redis;
  let wl;

  beforeEach(async () => {
    redis = fakeRedis();
    wl = createWaitlist(redis);
    await wl.join({ patientId: 5, doctorId: 1, date: DAY });
    await wl.join({ patientId: 6, doctorId: 1, date: DAY });
    await wl.join({ patientId: 7, doctorId: 1, date: DAY });
  });

  test('join gives the position and stops duplicates', async () => {
    expect(await wl.join({ patientId: 8, doctorId: 1, date: DAY })).toBe(4);
    expect(await wl.join({ patientId: 5, doctorId: 1, date: DAY })).toBeNull();
  });

  test('first patient in line gets the freed slot', async () => {
    const book = jest.fn(async (entry) => ({ appointment_id: 99, patient: entry.patientId }));
    const result = await wl.promote({ doctorId: 1, date: DAY }, { book, alreadyBooked: async () => false });
    expect(result.promoted.entry.patientId).toBe(5);
    expect(book).toHaveBeenCalledTimes(1);
    expect(await ids(wl)).toEqual([6, 7]);
  });

  test('if the booking fails (slot taken again) the patient stays at the front', async () => {
    const book = async () => { throw new HttpError(409, 'taken', { code: 'SLOT_TAKEN' }); };
    const result = await wl.promote({ doctorId: 1, date: DAY }, { book, alreadyBooked: async () => false });
    expect(result.promoted).toBeNull();
    expect(await ids(wl)).toEqual([5, 6, 7]);
  });

  test('if the database crashes the patient is not lost and the error is thrown for a retry', async () => {
    const book = async () => { throw new Error('connect ECONNREFUSED'); };
    await expect(wl.promote({ doctorId: 1, date: DAY }, { book, alreadyBooked: async () => false }))
      .rejects.toThrow('ECONNREFUSED');
    expect(await ids(wl)).toEqual([5, 6, 7]);
  });

  test('a patient busy at that time is skipped but keeps their place', async () => {
    const book = async (entry) => {
      if (entry.patientId === 5) throw new HttpError(409, 'busy', { code: 'PATIENT_CLASH' });
      return { appointment_id: 1 };
    };
    const result = await wl.promote({ doctorId: 1, date: DAY }, { book, alreadyBooked: async () => false });
    expect(result.promoted.entry.patientId).toBe(6);
    expect(await ids(wl)).toEqual([5, 7]);
  });

  test('a deleted patient goes to the failed list instead of disappearing', async () => {
    const book = async (entry) => {
      if (entry.patientId === 5) throw new HttpError(404, 'Patient 5 not found', { code: 'PATIENT_NOT_FOUND' });
      return { appointment_id: 1 };
    };
    const result = await wl.promote({ doctorId: 1, date: DAY }, { book, alreadyBooked: async () => false });
    expect(result.promoted.entry.patientId).toBe(6);
    expect(redis.data[FAILED_KEY].map((r) => JSON.parse(r).patientId)).toEqual([5]);
  });

  test('recoverAll puts patients left in processing back at the front', async () => {
    // pretend the worker died after moving patient 5 to processing
    await redis.lmove(listKey(1, DAY), `${listKey(1, DAY)}:processing`, 'LEFT', 'RIGHT');
    expect(await ids(wl)).toEqual([6, 7]);
    expect(await wl.recoverAll()).toBe(1);
    expect(await ids(wl)).toEqual([5, 6, 7]);
  });

  test('leave removes the patient', async () => {
    expect(await wl.leave({ patientId: 6, doctorId: 1, date: DAY })).toBe(true);
    expect(await wl.leave({ patientId: 6, doctorId: 1, date: DAY })).toBe(false);
    expect(await ids(wl)).toEqual([5, 7]);
  });
});
