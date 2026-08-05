const { v4: uuidv4 } = require('uuid');

/** Generates a short, human-friendly code like RES-8F3K92 */
function generateCode(prefix) {
  const rand = uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `${prefix}-${rand}`;
}

/** Sequential-looking invoice/order numbers: INV-20260727-0001 style using a DB counter table would be ideal;
 *  this timestamp+random fallback avoids collisions without an extra table. */
function generateNumber(prefix) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${date}-${rand}`;
}

function paginationParams(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function nightsBetween(checkIn, checkOut) {
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 1);
}

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** Formats an amount using the hotel's configured currency symbol/position (for emails, PDFs, etc). */
function formatCurrency(value, settings) {
  const amount = money(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = settings?.currency_symbol || '$';
  return settings?.currency_position === 'after' ? `${amount}${symbol}` : `${symbol}${amount}`;
}

module.exports = { generateCode, generateNumber, paginationParams, nightsBetween, money, formatCurrency };
