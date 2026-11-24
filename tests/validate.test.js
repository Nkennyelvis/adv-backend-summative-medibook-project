const { validatePatient, validateDoctor, isId } = require('../src/utils/validate');

describe('validatePatient', () => {
  const good = { full_name: 'Ama Mensah', email: 'ama@mail.com', phone: '0244-111-222' };

  test('a complete patient has no errors', () => {
    expect(validatePatient(good)).toEqual([]);
  });

  test('missing fields are reported', () => {
    const errors = validatePatient({});
    expect(errors).toHaveLength(3);
  });

  test('bad email and future birth date are reported', () => {
    const errors = validatePatient({ ...good, email: 'not-an-email', date_of_birth: '2999-01-01' });
    expect(errors.join(' ')).toMatch(/email/);
    expect(errors.join(' ')).toMatch(/date_of_birth/);
  });

  test('partial update only checks the fields that were sent', () => {
    expect(validatePatient({ phone: '0555 123 456' }, true)).toEqual([]);
    expect(validatePatient({}, true)).toEqual(['Send at least one field to update']);
  });
});

describe('validateDoctor', () => {
  const good = {
    full_name: 'Dr. Test', email: 'dr@test.com', specialty: 'Dermatology', consultation_fee: 150, room: 'R-1',
  };

  test('a complete doctor has no errors', () => {
    expect(validateDoctor(good)).toEqual([]);
  });

  test('fee must be a positive number', () => {
    expect(validateDoctor({ ...good, consultation_fee: 0 })).toHaveLength(1);
    expect(validateDoctor({ ...good, consultation_fee: 'abc' })).toHaveLength(1);
    expect(validateDoctor({ ...good, consultation_fee: true })).toHaveLength(1);
  });
});

describe('isId', () => {
  test('only positive whole numbers', () => {
    expect(isId(5)).toBe(true);
    expect(isId('12')).toBe(true);
    expect(isId(0)).toBe(false);
    expect(isId(-1)).toBe(false);
    expect(isId('1.5')).toBe(false);
    expect(isId('1 OR 1=1')).toBe(false);
    expect(isId(undefined)).toBe(false);
  });
});
