const cron = require('node-cron');
const { pool } = require('../config/db');
const { sendMail, isConfigured } = require('../utils/mailer');
const { lowStockDigestEmail } = require('../utils/emailTemplates');
const { getHotelSettings } = require('../utils/hotelSettings');
const { formatCurrency, money } = require('../utils/helpers');
const logger = require('../utils/logger');

/** Sends one low-stock digest email to every active admin/manager, if there's anything to report. */
async function runLowStockDigest() {
  if (!isConfigured()) return; // silently skip — mailer already logs this once at startup

  try {
    const [lowStock] = await pool.query(
      'SELECT id, name, quantity_on_hand, reorder_level, unit FROM inventory_items WHERE quantity_on_hand <= reorder_level ORDER BY name'
    );
    if (!lowStock.length) {
      logger.info('Low stock digest: nothing to report today.');
      return;
    }

    const [[valuation]] = await pool.query('SELECT COALESCE(SUM(quantity_on_hand * unit_cost),0) AS total_value FROM inventory_items');
    const [recipients] = await pool.query(
      `SELECT u.email, u.full_name FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name IN ('admin', 'manager') AND u.status = 'active' AND u.email IS NOT NULL`
    );
    if (!recipients.length) {
      logger.info('Low stock digest: no admin/manager recipients found.');
      return;
    }

    const settings = await getHotelSettings();
    const { subject, html } = lowStockDigestEmail({
      hotelName: settings.hotel_name,
      items: lowStock,
      totalInventoryValue: money(valuation.total_value),
      formatMoney: (v) => formatCurrency(v, settings)
    });

    for (const recipient of recipients) {
      // eslint-disable-next-line no-await-in-loop
      await sendMail({ to: recipient.email, subject, html });
    }
    logger.info(`Low stock digest sent to ${recipients.length} recipient(s) — ${lowStock.length} item(s) flagged.`);
  } catch (err) {
    logger.error(`Low stock digest job failed: ${err.message}`);
  }
}

/** Registers the daily cron schedule (default 07:00 server time). Call once at server startup. */
function scheduleLowStockDigest() {
  const schedule = process.env.LOW_STOCK_DIGEST_CRON || '0 7 * * *';
  cron.schedule(schedule, runLowStockDigest);
  logger.info(`Low stock digest scheduled (cron: "${schedule}").`);
}

module.exports = { scheduleLowStockDigest, runLowStockDigest };
