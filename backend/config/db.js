const mysql = require('mysql2/promise');
require('dotenv').config();

// Cloud-hosted MySQL-compatible databases (TiDB Cloud, PlanetScale, Aiven, etc.)
// require TLS. Local MySQL and the Docker Compose setup do not use it.
// Set DB_SSL=true in .env to enable — relies on Node's built-in trusted CA
// store, which already covers the public CAs these providers use.
const useSSL = String(process.env.DB_SSL).toLowerCase() === 'true';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hotelpro5',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_LIMIT || '10', 10),
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: true,
  ...(useSSL ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {})
});

async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  return true;
}

module.exports = { pool, testConnection };