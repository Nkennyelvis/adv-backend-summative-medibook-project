const { calculateRefund, refundPercent } = require('../src/utils/refund');

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-12-01T08:00:00');
const hoursFromNow = (h) => new Date(now.getTime() + h * HOUR);

describe('refund calculator', () => {
  test('more than 48 hours notice gives 100%', () => {
    const r = calculateRefund(150, hoursFromNow(72), now);
    expect(r.percent).toBe(100);
    expect(r.amount).toBe(150);
  });

  test('exactly 48 hours notice gives 50% (boundary)', () => {
    const r = calculateRefund(150, hoursFromNow(48), now);
    expect(r.percent).toBe(50);
    expect(r.amount).toBe(75);
  });

  test('48 hours and 1 minute gives 100%', () => {
    expect(calculateRefund(100, new Date(hoursFromNow(48).getTime() + 60000), now).percent).toBe(100);
  });

  test('between 24 and 48 hours gives 50%', () => {
    const r = calculateRefund(100, hoursFromNow(30), now);
    expect(r.percent).toBe(50);
    expect(r.amount).toBe(50);
  });

  test('exactly 24 hours notice gives 50% (boundary)', () => {
    expect(calculateRefund(100, hoursFromNow(24), now).percent).toBe(50);
  });

  test('less than 24 hours gives 0%', () => {
    const r = calculateRefund(100, new Date(hoursFromNow(24).getTime() - 60000), now);
    expect(r.percent).toBe(0);
    expect(r.amount).toBe(0);
  });

  test('rounds money to 2 decimals', () => {
    expect(calculateRefund(99.99, hoursFromNow(30), now).amount).toBe(50);
    expect(calculateRefund(120.35, hoursFromNow(30), now).amount).toBe(60.18);
  });

  test('returns the hours of notice', () => {
    expect(calculateRefund(100, hoursFromNow(36), now).hoursNotice).toBe(36);
  });

  test('refundPercent tiers', () => {
    expect(refundPercent(100)).toBe(100);
    expect(refundPercent(48.01)).toBe(100);
    expect(refundPercent(48)).toBe(50);
    expect(refundPercent(24)).toBe(50);
    expect(refundPercent(23.99)).toBe(0);
    expect(refundPercent(0)).toBe(0);
  });
});
