const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// Error codes that mean "we can't reach/authenticate with MySQL at all" —
// as opposed to "MySQL is reachable but our tables aren't there yet",
// which is the genuine not-installed case.
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ENOTFOUND', 'ETIMEDOUT',
  'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_DBACCESS_DENIED_ERROR',
  'PROTOCOL_SEQUENCE_TIMEOUT', 'ECONNRESET'
]);

// GET /api/setup/status — the frontend calls this on load to decide whether
// to show the installation wizard or the normal login screen.
router.get('/status', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, hotel_name, currency_code, installed_at FROM hotel_settings LIMIT 1');
    const [[userCount]] = await pool.query('SELECT COUNT(*) AS count FROM users');
    res.json({
      installed: !!(rows[0] && rows[0].installed_at && userCount.count > 0),
      hotelName: rows[0]?.hotel_name || null,
      currencyCode: rows[0]?.currency_code || null,
      dbUnreachable: false
    });
  } catch (err) {
    if (CONNECTION_ERROR_CODES.has(err.code)) {
      // The database itself is unreachable — don't silently claim "not installed",
      // since that sends an already-installed hotel back through the wizard.
      logger.error(`Setup status check: database unreachable — ${err.code}: ${err.message}`);
      return res.json({
        installed: false,
        dbUnreachable: true,
        dbErrorCode: err.code,
        hotelName: null,
        currencyCode: null
      });
    }
    // Otherwise (e.g. ER_NO_SUCH_TABLE) — the DB is reachable but schema/data
    // genuinely isn't there yet, which is the real "not installed" case.
    res.json({ installed: false, dbUnreachable: false, hotelName: null, currencyCode: null });
  }
});

// POST /api/setup/install — used by the browser-based first-run wizard.
// Only works once: it refuses if the system is already installed. This
// assumes the database schema has already been applied (via `npm run migrate`
// or the CLI wizard) and the DB connection in .env is already valid — this
// endpoint only writes the hotel profile, currency, and the first admin user.
router.post('/install', async (req, res, next) => {
  try {
    const [[userCount]] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const [existingSettings] = await pool.query('SELECT id, installed_at FROM hotel_settings LIMIT 1');
    if (userCount.count > 0 && existingSettings[0]?.installed_at) {
      throw new AppError('HotelPro 5.0 is already installed. Please log in instead.', 409);
    }

    const {
      hotelName, legalName, address, city, state, country, phone, email, timezone,
      currencyCode, currencySymbol, currencyPosition, taxPercent, taxLabel, serviceChargePercent,
      checkinTime, checkoutTime, admin
    } = req.body;

    if (!hotelName || !currencyCode || !currencySymbol) {
      throw new AppError('Hotel name and currency selection are required.', 422);
    }
    if (!admin || !admin.fullName || !admin.email || !admin.username || !admin.password) {
      throw new AppError('Administrator account details are required.', 422);
    }
    if (admin.password.length < 8) throw new AppError('Admin password must be at least 8 characters.', 422);

    if (existingSettings.length) {
      await pool.query(
        `UPDATE hotel_settings SET hotel_name=?, legal_name=?, address=?, city=?, state=?, country=?, phone=?, email=?,
         currency_code=?, currency_symbol=?, currency_position=?, timezone=?, tax_percent=?, tax_label=?,
         service_charge_percent=?, checkin_time=?, checkout_time=?, installed_at=NOW() WHERE id=?`,
        [hotelName, legalName || null, address || null, city || null, state || null, country || null, phone || null,
         email || null, currencyCode, currencySymbol, currencyPosition || 'before', timezone || 'UTC',
         taxPercent || 0, taxLabel || 'Tax', serviceChargePercent || 0, checkinTime || '14:00:00',
         checkoutTime || '12:00:00', existingSettings[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO hotel_settings
         (hotel_name, legal_name, address, city, state, country, phone, email, currency_code, currency_symbol,
          currency_position, timezone, tax_percent, tax_label, service_charge_percent, checkin_time, checkout_time, installed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW())`,
        [hotelName, legalName || null, address || null, city || null, state || null, country || null, phone || null,
         email || null, currencyCode, currencySymbol, currencyPosition || 'before', timezone || 'UTC',
         taxPercent || 0, taxLabel || 'Tax', serviceChargePercent || 0, checkinTime || '14:00:00', checkoutTime || '12:00:00']
      );
    }

    if (userCount.count === 0) {
      const [[adminRole]] = await pool.query('SELECT id FROM roles WHERE name = "admin" LIMIT 1');
      if (!adminRole) throw new AppError('Default roles are missing — run the database migration first.', 500);
      const hash = await bcrypt.hash(admin.password, 12);
      await pool.query(
        'INSERT INTO users (role_id, full_name, email, username, password_hash) VALUES (?,?,?,?,?)',
        [adminRole.id, admin.fullName, admin.email, admin.username, hash]
      );
    }

    res.status(201).json({ message: 'HotelPro 5.0 installed successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
