const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { createLogger } = require('../src/utils/auditLogger');

describe('audit logger', () => {
  let dir;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'medibook-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  test('creates the logs folder and appends JSON lines', async () => {
    const file = path.join(dir, 'logs', 'audit.log');
    const log = createLogger(file);
    await log.append('appointment_booked', { appointmentId: 1 });
    await log.append('appointment_cancelled', { appointmentId: 1 });

    const lines = (await fs.readFile(file, 'utf8')).trim().split('\n').map(JSON.parse);
    expect(lines).toHaveLength(2);
    expect(lines[0].event).toBe('appointment_booked');
    expect(lines[1].appointmentId).toBe(1);
    expect(lines[0].time).toBeDefined();
  });

  test('prepend puts the entry at the top', async () => {
    const file = path.join(dir, 'audit.log');
    const log = createLogger(file);
    await log.append('second', {});
    await log.prepend('first', {});
    const lines = (await fs.readFile(file, 'utf8')).trim().split('\n').map(JSON.parse);
    expect(lines.map((l) => l.event)).toEqual(['first', 'second']);
  });

  test('a write failure does not throw', async () => {
    // a folder where the file should be -> appendFile fails
    const file = path.join(dir, 'is-a-folder');
    await fs.mkdir(file);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger(file);
    await expect(log.append('x', {})).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
