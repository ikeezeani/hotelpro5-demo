const express = require('express');
const { pool } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/settings — public-safe subset used by the frontend (currency, name, logo)
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM hotel_settings ORDER BY id DESC LIMIT 1');
    res.json(rows[0] || null);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings — admin updates hotel/currency/tax configuration
router.put('/', authenticate, authorize('all', 'write'), async (req, res, next) => {
  try {
    const fields = [
      'hotel_name', 'legal_name', 'address', 'city', 'state', 'country', 'phone', 'email',
      'website', 'logo_url', 'currency_code', 'currency_symbol', 'currency_position',
      'timezone', 'date_format', 'tax_percent', 'tax_label', 'service_charge_percent',
      'checkin_time', 'checkout_time'
    ];
    const updates = [];
    const values = [];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    });
    if (!updates.length) return res.status(422).json({ error: 'No valid fields to update.' });

    const [existing] = await pool.query('SELECT id FROM hotel_settings LIMIT 1');
    if (existing.length) {
      values.push(existing[0].id);
      await pool.query(`UPDATE hotel_settings SET ${updates.join(', ')} WHERE id = ?`, values);
    } else {
      await pool.query(
        `INSERT INTO hotel_settings (hotel_name, currency_code, currency_symbol) VALUES (?, ?, ?)`,
        [req.body.hotel_name || 'My Hotel', req.body.currency_code || 'USD', req.body.currency_symbol || '$']
      );
    }
    const [rows] = await pool.query('SELECT * FROM hotel_settings ORDER BY id DESC LIMIT 1');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/currencies — supported currency list for the wizard / settings UI
router.get('/currencies', (req, res) => {
  res.json(require('../utils/currencies.json'));
});

module.exports = router;
