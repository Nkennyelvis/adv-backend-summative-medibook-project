// runs database/schema.sql and database/seed.sql (same as running them in the mysql client)
const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');
const { db } = require('../src/config/env');
const { localOffset } = require('../src/utils/timezone');

async function main() {
  const conn = await mysql.createConnection({
    host: db.host, port: db.port, user: db.user, password: db.password, multipleStatements: true,
  });
  // so the seed's CURDATE() is "today" for us, not today in UTC
  await conn.query('SET time_zone = ?', [localOffset()]);
  for (const file of ['schema.sql', 'seed.sql']) {
    const sql = await fs.readFile(path.join(__dirname, '..', 'database', file), 'utf8');
    await conn.query(sql);
    console.log(`ran database/${file}`);
  }
  await conn.end();
}

main().catch((err) => {
  console.error('Database setup failed:', err.message);
  process.exit(1);
});
