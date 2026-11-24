const fs = require('fs/promises');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, '..', '..', 'logs', 'audit.log');

// every entry is one JSON line. only async fs calls are used (no *Sync)
function createLogger(filePath = DEFAULT_FILE) {
  let queue = Promise.resolve(); // writes go one after another so lines don't get mixed up

  function makeLine(event, data) {
    return `${JSON.stringify({ time: new Date().toISOString(), event, ...data })}\n`;
  }

  async function ensureDir() {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  // a logging problem should never break the user's request, so errors are only printed
  function run(task) {
    queue = queue.then(task).catch((err) => {
      console.error('Audit log write failed:', err.message);
    });
    return queue;
  }

  function append(event, data = {}) {
    return run(async () => {
      await ensureDir();
      await fs.appendFile(filePath, makeLine(event, data), 'utf8');
    });
  }

  // puts the entry at the top of the file (read old content, write new line + old content)
  function prepend(event, data = {}) {
    return run(async () => {
      await ensureDir();
      let old = '';
      try {
        old = await fs.readFile(filePath, 'utf8');
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
      await fs.writeFile(filePath, makeLine(event, data) + old, 'utf8');
    });
  }

  return { append, prepend, filePath };
}

module.exports = createLogger(process.env.AUDIT_LOG_FILE || DEFAULT_FILE);
module.exports.createLogger = createLogger;
