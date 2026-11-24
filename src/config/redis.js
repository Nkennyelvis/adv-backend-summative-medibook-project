const { Redis } = require('ioredis');
const { redis } = require('./env');

// the web server should fail fast if redis is down (so a request is not stuck waiting)
function createClient() {
  const client = new Redis({
    host: redis.host,
    port: redis.port,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  let warned = false;
  client.on('error', (err) => {
    if (!warned) console.error('Redis error:', err.message);
    warned = true;
  });
  client.on('ready', () => { warned = false; });
  return client;
}

// bullmq workers need maxRetriesPerRequest: null
function createWorkerClient() {
  return new Redis({ host: redis.host, port: redis.port, maxRetriesPerRequest: null });
}

module.exports = { createClient, createWorkerClient };
