const {
  parseDateTime, parseDate, checkSlot, toSqlDateTime,
} = require('../src/utils/slots');

const now = new Date('2026-12-01T08:00:00');
const slot = (text) => checkSlot(parseDateTime(text), now);

describe('parseDateTime', () => {
  test('reads both "YYYY-MM-DD HH:mm" and the T format', () => {
    expect(toSqlDateTime(parseDateTime('2026-12-02 09:30'))).toBe('2026-12-02 09:30:00');
    expect(toSqlDateTime(parseDateTime('2026-12-02T14:00:00'))).toBe('2026-12-02 14:00:00');
  });

  test('rejects malformed or impossible dates', () => {
    expect(parseDateTime('tomorrow at 9')).toBeNull();
    expect(parseDateTime('2026-13-01 09:00')).toBeNull();
    expect(parseDateTime('2026-02-30 09:00')).toBeNull();
    expect(parseDateTime('2026-12-01 25:00')).toBeNull();
    expect(parseDateTime('')).toBeNull();
    expect(parseDateTime(12345)).toBeNull();
    expect(parseDateTime(undefined)).toBeNull();
  });

  test('parseDate only accepts a plain date', () => {
    expect(parseDate('2026-12-01')).not.toBeNull();
    expect(parseDate('2026-12-01 09:00')).toBeNull();
    expect(parseDate('01/12/2026')).toBeNull();
  });
});

describe('checkSlot (working hours + 30 min slots + future)', () => {
  test('09:00 and 16:30 are valid', () => {
    expect(slot('2026-12-02 09:00')).toBeNull();
    expect(slot('2026-12-02 16:30')).toBeNull();
  });

  test('17:00 exactly is rejected (would end after closing)', () => {
    expect(slot('2026-12-02 17:00')).toMatch(/09:00 and 17:00/);
  });

  test('before 09:00 is rejected', () => {
    expect(slot('2026-12-02 08:30')).toMatch(/09:00 and 17:00/);
  });

  test('09:15 is not on a slot boundary', () => {
    expect(slot('2026-12-02 09:15')).toMatch(/hour or half hour/);
  });

  test('seconds that are not :00 are rejected', () => {
    expect(slot('2026-12-02 09:30:10')).toMatch(/hour or half hour/);
  });

  test('a slot in the past is rejected', () => {
    expect(slot('2026-11-30 10:00')).toMatch(/future/);
  });

  test('a valid time earlier today is rejected', () => {
    const later = new Date('2026-12-01T11:00:00');
    expect(checkSlot(parseDateTime('2026-12-01 10:30'), later)).toMatch(/future/);
  });

  test('a null date is rejected', () => {
    expect(checkSlot(null, now)).toBe('Invalid date/time');
  });
});
