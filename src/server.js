const app = require('./app');
const { port } = require('./config/env');
const pool = require('./config/db');
const audit = require('./utils/auditLogger');
const queues = require('./queues');

// connect to redis now, not on the first request
queues.getQueues();

app.listen(port, async () => {
  console.log(`MediBook API running on http://localhost:${port}`);
  audit.prepend('server_started', { port });
  try {
    await pool.query('SELECT 1');
    console.log('Connected to MySQL');
  } catch (err) {
    console.error('Could not connect to MySQL:', err.message);
  }
});
