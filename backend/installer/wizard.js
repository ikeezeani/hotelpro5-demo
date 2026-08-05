#!/usr/bin/env node
/**
 * HotelPro 5.0 — Installation Wizard
 * Run with: npm run install-wizard  (from the /backend folder)
 *
 * Walks the installer through, in order:
 *   1. Database connection details (and creates the DB if missing)
 *   2. Applying the schema
 *   3. Hotel profile (name, address, contact)
 *   4. Currency selection
 *   5. Tax / service charge defaults
 *   6. Creating the first administrator account
 *   7. Writing backend/.env
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const currencies = require('../utils/currencies.json');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, (answer) => resolve(answer.trim())));
const askHidden = (q) => ask(q); // kept simple/dependency-free; terminals still echo input

function line() { console.log('─'.repeat(60)); }
function step(n, title) {
  console.log('');
  line();
  console.log(`STEP ${n}: ${title}`);
  line();
}

async function main() {
  console.log(`
  ╦ ╦╔═╗╔╦╗╔═╗╦  ╔═╗╦═╗╔═╗  ╔═╗ ╔═╗
  ╠═╣║ ║ ║ ║╣ ║  ╠═╝╠╦╝║ ║  ╚═╗ ║ ║
  ╩ ╩╚═╝ ╩ ╚═╝╩═╝╩  ╩╚═╩ ╩  ╚═╝o╚═╝
  Production Hotel Management System — Installer
`);

  /* ---------------------- Step 1: Database connection ---------------------- */
  step(1, 'Database Connection');
  const dbHost = (await ask('MySQL host [localhost]: ')) || 'localhost';
  const dbPort = (await ask('MySQL port [3306]: ')) || '3306';
  const dbUser = (await ask('MySQL user [root]: ')) || 'root';
  const dbPassword = await askHidden('MySQL password (leave blank if none): ');
  const dbName = (await ask('Database name [hotelpro5]: ')) || 'hotelpro5';

  console.log('\nConnecting...');
  const rootConn = await mysql.createConnection({ host: dbHost, port: dbPort, user: dbUser, password: dbPassword });
  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await rootConn.end();
  console.log(`✔ Database "${dbName}" is ready.`);

  const conn = await mysql.createConnection({
    host: dbHost, port: dbPort, user: dbUser, password: dbPassword, database: dbName, multipleStatements: true
  });

  /* ---------------------------- Step 2: Schema ------------------------------ */
  step(2, 'Installing Database Schema');
  const schemaSql = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
  await conn.query(schemaSql);
  console.log('✔ Tables, indexes and default roles installed.');

  /* --------------------------- Step 3: Hotel profile ------------------------ */
  step(3, 'Hotel Profile');
  const hotelName = await ask('Hotel name: ');
  const legalName = await ask('Legal/registered name (optional): ');
  const address = await ask('Street address: ');
  const city = await ask('City: ');
  const stateProv = await ask('State / Province: ');
  const country = await ask('Country: ');
  const phone = await ask('Phone number: ');
  const email = await ask('Contact email: ');
  const timezone = (await ask('Timezone [Africa/Lagos]: ')) || 'Africa/Lagos';

  /* ----------------------------- Step 4: Currency ---------------------------- */
  step(4, 'Currency Selection');
  console.log('Available currencies:\n');
  currencies.forEach((c, i) => console.log(`  ${String(i + 1).padStart(2)}. ${c.code}  ${c.symbol}   ${c.name}`));
  let currency;
  while (!currency) {
    const choice = await ask(`\nSelect a currency (1-${currencies.length}): `);
    const idx = parseInt(choice, 10) - 1;
    if (currencies[idx]) currency = currencies[idx];
    else console.log('Please enter a valid number from the list.');
  }
  console.log(`✔ Currency set to ${currency.name} (${currency.code} ${currency.symbol})`);
  const currencyPosition = (await ask('Show symbol before or after amount? [before/after, default before]: ')) || 'before';

  /* --------------------------- Step 5: Tax / Charges -------------------------- */
  step(5, 'Tax & Service Charge Defaults');
  const taxPercent = parseFloat((await ask('Default tax percentage [0]: ')) || '0');
  const taxLabel = (await ask('Tax label [Tax]: ')) || 'Tax';
  const serviceChargePercent = parseFloat((await ask('Default service charge percentage [0]: ')) || '0');
  const checkinTime = (await ask('Standard check-in time [14:00]: ')) || '14:00';
  const checkoutTime = (await ask('Standard check-out time [12:00]: ')) || '12:00';

  await conn.query(
    `INSERT INTO hotel_settings
     (hotel_name, legal_name, address, city, state, country, phone, email, currency_code, currency_symbol,
      currency_position, timezone, tax_percent, tax_label, service_charge_percent, checkin_time, checkout_time, installed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW())`,
    [hotelName, legalName || null, address, city, stateProv, country, phone, email,
     currency.code, currency.symbol, currencyPosition, timezone, taxPercent, taxLabel,
     serviceChargePercent, `${checkinTime}:00`, `${checkoutTime}:00`]
  );
  console.log('✔ Hotel profile saved.');

  /* --------------------------- Step 6: Admin account --------------------------- */
  step(6, 'Create Administrator Account');
  const adminName = await ask('Your full name: ');
  const adminEmail = await ask('Admin email: ');
  const adminUsername = await ask('Admin username: ');
  let adminPassword = '';
  while (adminPassword.length < 8) {
    adminPassword = await askHidden('Admin password (min 8 characters): ');
    if (adminPassword.length < 8) console.log('Password too short — please try again.');
  }
  const hash = await bcrypt.hash(adminPassword, 12);
  const [adminRoleRows] = await conn.query('SELECT id FROM roles WHERE name = "admin" LIMIT 1');
  const adminRole = adminRoleRows[0];
  await conn.query(
    `INSERT INTO users (role_id, full_name, email, username, password_hash) VALUES (?,?,?,?,?)`,
    [adminRole.id, adminName, adminEmail, adminUsername, hash]
  );
  console.log('✔ Administrator account created.');
  await conn.end();

  /* ------------------------------ Step 7: .env -------------------------------- */
  step(7, 'Writing Configuration File');
  const jwtSecret = require('crypto').randomBytes(48).toString('hex');
  const envPath = path.join(__dirname, '../.env');
  const envContent = `NODE_ENV=production
PORT=3000
APP_URL=http://localhost:3000
CLIENT_URL=http://localhost:5172

DB_HOST=${dbHost}
DB_PORT=${dbPort}
DB_USER=${dbUser}
DB_PASSWORD=${dbPassword}
DB_NAME=${dbName}
DB_POOL_LIMIT=10

JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=8h
REFRESH_TOKEN_EXPIRES_IN=30d
BCRYPT_SALT_ROUNDS=12

DEFAULT_CURRENCY_CODE=${currency.code}
DEFAULT_CURRENCY_SYMBOL=${currency.symbol}

PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
STRIPE_SECRET_KEY=
STRIPE_PUBLIC_KEY=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_PUBLIC_KEY=

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM="${hotelName} <no-reply@yourhotel.com>"

RATE_LIMIT_WINDOW_MIN=15
RATE_LIMIT_MAX=300
`;
  fs.writeFileSync(envPath, envContent);
  console.log(`✔ Configuration written to ${envPath}`);

  const divider = '─'.repeat(60);
  console.log(`
${divider}
 INSTALLATION COMPLETE
${divider}
 Hotel:      ${hotelName}
 Currency:   ${currency.name} (${currency.code} ${currency.symbol})
 Admin user: ${adminUsername}

 Next steps:
   1. cd backend && npm start           # starts the API on port 3000
   2. cd frontend && npm run dev        # starts the web app on port 5172
   3. Log in with the admin account you just created
   4. (Optional) Add your payment gateway keys to backend/.env

 To add payment gateways later, edit backend/.env:
   PAYSTACK_SECRET_KEY / STRIPE_SECRET_KEY / FLUTTERWAVE_SECRET_KEY
${divider}
`);
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n✘ Installation failed:', err.message);
  rl.close();
  process.exit(1);
});
