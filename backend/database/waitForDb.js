/**
 * Polls the configured MySQL connection until it accepts connections,
 * or exits with an error after a timeout. Used by docker-entrypoint.sh
 * so the API container doesn't crash-loop while the db container is
 * still initializing.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const MAX_ATTEMPTS = 30;
const DELAY_MS = 2000;

async function waitForDb() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
      });
      await conn.ping();
      await conn.end();
      console.log('✔ Database is reachable.');
      return;
    } catch (err) {
      console.log(`Waiting for database... (attempt ${attempt}/${MAX_ATTEMPTS}) ${err.code || err.message}`);
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
  console.error('✘ Database did not become reachable in time.');
  process.exit(1);
}

waitForDb();
