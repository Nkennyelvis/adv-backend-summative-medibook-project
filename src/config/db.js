const mysql = require('mysql2/promise');
const { db } = require('./env');
const { localOffset } = require('../utils/timezone');

const pool = mysql.createPool({
  ...db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // DATETIME comes back as 'YYYY-MM-DD HH:MM:SS' text
  decimalNumbers: true,
  timezone: localOffset(),
});

// make MySQL use the same timezone as Node
pool.pool.on('connection', (conn) => {
  conn.query('SET time_zone = ?', [localOffset()]);
});

module.exports = pool;
