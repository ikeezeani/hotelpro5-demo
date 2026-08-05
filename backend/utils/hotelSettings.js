const { pool } = require('../config/db');

/** Returns the single hotel_settings row, or a safe default if not yet configured. */
async function getHotelSettings() {
  const [rows] = await pool.query('SELECT * FROM hotel_settings ORDER BY id DESC LIMIT 1');
  return rows[0] || { hotel_name: 'HotelPro 5.0', currency_symbol: '$', currency_position: 'before' };
}

module.exports = { getHotelSettings };
