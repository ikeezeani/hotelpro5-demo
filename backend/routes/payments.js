const express = require('express');
const https = require('https');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { money, formatCurrency } = require('../utils/helpers');
const { sendMail } = require('../utils/mailer');
const { invoiceReceiptEmail } = require('../utils/emailTemplates');
const { getHotelSettings } = require('../utils/hotelSettings');

const router = express.Router();

function httpsGetJson(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    https.get({ hostname, path, headers }, (resp) => {
      let data = '';
      resp.on('data', (chunk) => { data += chunk; });
      resp.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Fire-and-forget receipt email — shared by all three gateway verification routes below.
async function sendGatewayReceiptEmail(invoiceId, method, amountPaid, balanceDue) {
  try {
    const [[invoice]] = await pool.query('SELECT invoice_number, total_amount, guest_id FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice?.guest_id) return;
    const [[guest]] = await pool.query('SELECT first_name, last_name, email FROM guests WHERE id = ?', [invoice.guest_id]);
    if (!guest?.email) return;
    const settings = await getHotelSettings();
    const { subject, html } = invoiceReceiptEmail({
      hotelName: settings.hotel_name,
      guestName: `${guest.first_name} ${guest.last_name}`,
      invoiceNumber: invoice.invoice_number,
      totalAmount: invoice.total_amount,
      amountPaid, balanceDue, method,
      formatMoney: (v) => formatCurrency(v, settings)
    });
    await sendMail({ to: guest.email, subject, html });
  } catch (emailErr) {
    require('../utils/logger').error(`Gateway receipt email failed: ${emailErr.message}`);
  }
}

// POST /api/payments/paystack/verify  { reference, invoiceId }
router.post('/paystack/verify', authenticate, async (req, res, next) => {
  try {
    const { reference, invoiceId } = req.body;
    if (!reference || !invoiceId) throw new AppError('Reference and invoiceId are required.', 422);
    if (!process.env.PAYSTACK_SECRET_KEY) throw new AppError('Paystack is not configured. Set PAYSTACK_SECRET_KEY in .env.', 501);

    const result = await httpsGetJson('api.paystack.co', `/transaction/verify/${encodeURIComponent(reference)}`, {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
    });

    if (!result.status || result.data?.status !== 'success') {
      throw new AppError('Payment could not be verified.', 402);
    }

    const amount = money(result.data.amount / 100); // kobo -> major unit
    const [[invoice]] = await pool.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice) throw new AppError('Invoice not found.', 404);

    await pool.query(
      `INSERT INTO payments (invoice_id, method, amount, currency_code, transaction_ref, gateway_response, received_by)
       VALUES (?, 'paystack', ?, ?, ?, ?, ?)`,
      [invoiceId, amount, result.data.currency || invoice.currency_code, reference, JSON.stringify(result.data), req.user.id]
    );
    const newPaid = money(Number(invoice.amount_paid) + amount);
    const newBalance = money(Number(invoice.total_amount) - newPaid);
    const status = newBalance <= 0.01 ? 'paid' : 'partial';
    await pool.query('UPDATE invoices SET amount_paid = ?, balance_due = ?, status = ? WHERE id = ?', [newPaid, Math.max(newBalance, 0), status, invoiceId]);

    sendGatewayReceiptEmail(invoiceId, 'paystack', newPaid, Math.max(newBalance, 0));

    res.json({ message: 'Payment verified and recorded.', status });
  } catch (err) { next(err); }
});

// POST /api/payments/stripe/confirm  { paymentIntentId, invoiceId }
// Note: requires the `stripe` npm package if you enable this gateway; kept dependency-free here
// by calling Stripe's REST API directly so the base install stays lightweight.
router.post('/stripe/confirm', authenticate, async (req, res, next) => {
  try {
    const { paymentIntentId, invoiceId } = req.body;
    if (!paymentIntentId || !invoiceId) throw new AppError('paymentIntentId and invoiceId are required.', 422);
    if (!process.env.STRIPE_SECRET_KEY) throw new AppError('Stripe is not configured. Set STRIPE_SECRET_KEY in .env.', 501);

    const result = await httpsGetJson('api.stripe.com', `/v1/payment_intents/${paymentIntentId}`, {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`
    });
    if (result.status !== 'succeeded') throw new AppError('Stripe payment has not succeeded yet.', 402);

    const amount = money(result.amount / 100);
    const [[invoice]] = await pool.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice) throw new AppError('Invoice not found.', 404);

    await pool.query(
      `INSERT INTO payments (invoice_id, method, amount, currency_code, transaction_ref, gateway_response, received_by)
       VALUES (?, 'stripe', ?, ?, ?, ?, ?)`,
      [invoiceId, amount, (result.currency || invoice.currency_code).toUpperCase(), paymentIntentId, JSON.stringify(result), req.user.id]
    );
    const newPaid = money(Number(invoice.amount_paid) + amount);
    const newBalance = money(Number(invoice.total_amount) - newPaid);
    const status = newBalance <= 0.01 ? 'paid' : 'partial';
    await pool.query('UPDATE invoices SET amount_paid = ?, balance_due = ?, status = ? WHERE id = ?', [newPaid, Math.max(newBalance, 0), status, invoiceId]);

    sendGatewayReceiptEmail(invoiceId, 'stripe', newPaid, Math.max(newBalance, 0));

    res.json({ message: 'Payment confirmed and recorded.', status });
  } catch (err) { next(err); }
});

// POST /api/payments/flutterwave/verify  { transactionId, invoiceId }
router.post('/flutterwave/verify', authenticate, async (req, res, next) => {
  try {
    const { transactionId, invoiceId } = req.body;
    if (!transactionId || !invoiceId) throw new AppError('transactionId and invoiceId are required.', 422);
    if (!process.env.FLUTTERWAVE_SECRET_KEY) throw new AppError('Flutterwave is not configured. Set FLUTTERWAVE_SECRET_KEY in .env.', 501);

    const result = await httpsGetJson('api.flutterwave.com', `/v3/transactions/${transactionId}/verify`, {
      Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`
    });
    if (result.status !== 'success' || result.data?.status !== 'successful') {
      throw new AppError('Payment could not be verified.', 402);
    }

    const amount = money(result.data.amount);
    const [[invoice]] = await pool.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice) throw new AppError('Invoice not found.', 404);

    await pool.query(
      `INSERT INTO payments (invoice_id, method, amount, currency_code, transaction_ref, gateway_response, received_by)
       VALUES (?, 'flutterwave', ?, ?, ?, ?, ?)`,
      [invoiceId, amount, result.data.currency || invoice.currency_code, transactionId, JSON.stringify(result.data), req.user.id]
    );
    const newPaid = money(Number(invoice.amount_paid) + amount);
    const newBalance = money(Number(invoice.total_amount) - newPaid);
    const status = newBalance <= 0.01 ? 'paid' : 'partial';
    await pool.query('UPDATE invoices SET amount_paid = ?, balance_due = ?, status = ? WHERE id = ?', [newPaid, Math.max(newBalance, 0), status, invoiceId]);

    sendGatewayReceiptEmail(invoiceId, 'flutterwave', newPaid, Math.max(newBalance, 0));

    res.json({ message: 'Payment verified and recorded.', status });
  } catch (err) { next(err); }
});

module.exports = router;
