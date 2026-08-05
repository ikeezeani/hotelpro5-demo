const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter = null;
let checkedConfig = false;

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function getTransporter() {
  if (!isConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    });
  }
  return transporter;
}

/**
 * Sends an email if SMTP is configured. Never throws — email delivery is a
 * best-effort side effect and should never break the request that triggered
 * it (e.g. creating a reservation should still succeed even if the
 * confirmation email fails to send).
 */
async function sendMail({ to, subject, html, text }) {
  if (!to) {
    logger.info(`Email skipped (no recipient): "${subject}"`);
    return { sent: false, reason: 'no_recipient' };
  }
  if (!isConfigured()) {
    if (!checkedConfig) {
      logger.info('SMTP is not configured — outgoing emails will be skipped. Set SMTP_HOST/SMTP_USER/SMTP_PASSWORD in .env to enable them.');
      checkedConfig = true;
    }
    return { sent: false, reason: 'smtp_not_configured' };
  }

  try {
    const from = process.env.SMTP_FROM || `HotelPro 5.0 <no-reply@${process.env.SMTP_HOST}>`;
    await getTransporter().sendMail({ from, to, subject, html, text: text || html.replace(/<[^>]+>/g, ' ') });
    logger.info(`Email sent to ${to}: "${subject}"`);
    return { sent: true };
  } catch (err) {
    logger.error(`Email failed to ${to}: "${subject}" — ${err.message}`);
    return { sent: false, reason: 'send_failed', error: err.message };
  }
}

module.exports = { sendMail, isConfigured };
