// Waitlist stored in Redis lists, one list per doctor per day:
//   waitlist:<doctorId>:<YYYY-MM-DD>              people waiting (first in = first served)
//   waitlist:<doctorId>:<YYYY-MM-DD>:processing   people being tried right now
//   waitlist:failed                               people we could never book (with the reason)
//
// When we try to promote someone we MOVE them to the processing list (LMOVE) instead of popping.
// So if the booking fails or the worker crashes, they are still in Redis and get put back.

const FAILED_KEY = 'waitlist:failed';

const listKey = (doctorId, date) => `waitlist:${doctorId}:${date}`;
const processingKey = (doctorId, date) => `${listKey(doctorId, date)}:processing`;

function createWaitlist(redis) {
  async function list(doctorId, date) {
    const raw = await redis.lrange(listKey(doctorId, date), 0, -1);
    return raw.map((r) => JSON.parse(r));
  }

  // returns the position in the line, or null if the patient is already waiting
  async function join({ patientId, doctorId, date }) {
    const waiting = await list(doctorId, date);
    if (waiting.some((e) => e.patientId === patientId)) return null;
    const entry = { patientId, doctorId, date, joinedAt: new Date().toISOString() };
    return redis.rpush(listKey(doctorId, date), JSON.stringify(entry));
  }

  async function leave({ patientId, doctorId, date }) {
    const key = listKey(doctorId, date);
    const raw = await redis.lrange(key, 0, -1);
    const found = raw.find((r) => JSON.parse(r).patientId === patientId);
    if (!found) return false;
    await redis.lrem(key, 1, found);
    return true;
  }

  // moves everything left in processing back to the FRONT of the line, in the same order
  async function restore(procKey, key) {
    while (await redis.lmove(procKey, key, 'RIGHT', 'LEFT')) {
      // keep going until processing is empty
    }
  }

  // called on worker start, in case the worker died in the middle of a promotion
  async function recoverAll() {
    let cursor = '0';
    let restored = 0;
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'waitlist:*:processing', 'COUNT', 100);
      cursor = next;
      for (const procKey of keys) {
        restored += await redis.llen(procKey);
        await restore(procKey, procKey.replace(/:processing$/, ''));
      }
    } while (cursor !== '0');
    return restored;
  }

  // tries waiting patients one by one until someone gets the freed slot.
  //   book(entry)          -> books the patient, throws HttpError if it can't
  //   alreadyBooked(entry) -> true if the patient already got a slot that day (so we just drop them)
  async function promote({ doctorId, date }, { book, alreadyBooked }) {
    const key = listKey(doctorId, date);
    const procKey = processingKey(doctorId, date);
    const result = { promoted: null, dropped: [], failed: [], skipped: [] };

    try {
      for (;;) {
        const raw = await redis.lmove(key, procKey, 'LEFT', 'RIGHT');
        if (!raw) break; // nobody waiting

        const entry = JSON.parse(raw);

        if (await alreadyBooked(entry)) {
          await redis.lrem(procKey, 1, raw);
          result.dropped.push(entry);
          continue;
        }

        try {
          const appointment = await book(entry);
          await redis.lrem(procKey, 1, raw);
          result.promoted = { entry, appointment };
          break;
        } catch (err) {
          if (err.code === 'PATIENT_CLASH') {
            // this patient is busy at that time, leave them in line and try the next one
            result.skipped.push(entry);
            continue;
          }
          if (err.code === 'PATIENT_NOT_FOUND') {
            // patient was deleted, we can never book them. keep a record instead of losing them
            await redis.rpush(FAILED_KEY, JSON.stringify({ ...entry, reason: err.message, failedAt: new Date().toISOString() }));
            await redis.lrem(procKey, 1, raw);
            result.failed.push(entry);
            continue;
          }
          // slot taken again / day full / db error: the patient stays at the front of the line
          result.stoppedBecause = err.message;
          if (!err.status) throw err; // unexpected error -> let the queue retry the job
          break;
        }
      }
    } finally {
      await restore(procKey, key);
    }
    return result;
  }

  return { list, join, leave, promote, recoverAll };
}

module.exports = { createWaitlist, listKey, processingKey, FAILED_KEY };
