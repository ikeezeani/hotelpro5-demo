/**
 * Applies database/schema.sql against the configured database.
 * Run with: npm run migrate  (after .env is configured)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const useSSL = String(process.env.DB_SSL).toLowerCase() === 'true';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hotelpro5',
    multipleStatements: true,
    ...(useSSL ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {})
  });

  console.log('Applying schema.sql ...');
  await connection.query(sql);
  console.log('✔ Database schema is up to date.');
  await connection.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});