const express = require('express');
const { pool } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { generateNumber, money, formatCurrency } = require('../utils/helpers');
const { sendMail } = require('../utils/mailer');
const { invoiceReceiptEmail } = require('../utils/emailTemplates');
const { getHotelSettings } = require('../utils/hotelSettings');

const router = express.Router();
router.use(authenticate);

/* --------------------------------- Folios -------------------------------- */

router.get('/folios/:id', async (req, res, next) => {
  try {
    const [[folio]] = await pool.query('SELECT * FROM folios WHERE id = ?', [req.params.id]);
    if (!folio) throw new AppError('Folio not found.', 404);
    const [charges] = await pool.query('SELECT * FROM folio_charges WHERE folio_id = ? ORDER BY created_at', [req.params.id]);
    const total = charges.reduce((sum, c) => sum + Number(c.amount), 0);
    res.json({ ...folio, charges, total: money(total) });
  } catch (err) { next(err); }
});

router.post('/folios/:id/charges', authorize('billing', 'write'), async (req, res, next) => {
  try {
    const { chargeType, description, amount } = req.body;
    const validTypes = ['room', 'pos', 'tax', 'service_charge', 'misc', 'discount', 'adjustment'];
    if (!validTypes.includes(chargeType) || !description || amount === undefined) {
      throw new AppError('Valid charge type, description and amount are required.', 422);
    }
    await pool.query(
      `INSERT INTO folio_charges (folio_id, charge_type, description, amount) VALUES (?,?,?,?)`,
      [req.params.id, chargeType, description, amount]
    );
    res.status(201).json({ message: 'Charge added to folio.' });
  } catch (err) { next(err); }
});

/* -------------------------------- Invoices -------------------------------- */

router.get('/invoices', async (req, res, next) => {
  try {
    const { status, guestId } = req.query;
    const where = []; const params = [];
    if (status) { where.push('i.status = ?'); params.push(status); }
    if (guestId) { where.push('i.guest_id = ?'); params.push(guestId); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT i.*, g.first_name, g.last_name FROM invoices i
       LEFT JOIN guests g ON g.id = i.guest_id ${whereSql} ORDER BY i.created_at DESC LIMIT 200`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/invoices/:id', async (req, res, next) => {
  try {
    const [[invoice]] = await pool.query('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    if (!invoice) throw new AppError('Invoice not found.', 404);
    const [payments] = await pool.query('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at', [req.params.id]);
    res.json({ ...invoice, payments });
  } catch (err) { next(err); }
});

// POST /api/billing/invoices — generate an invoice from a folio (checkout billing) or a POS order
router.post('/invoices', authorize('billing', 'write'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { folioId, posOrderId, taxPercent = 0, serviceChargePercent = 0, discountAmount = 0, currencyCode } = req.body;
    if (!folioId && !posOrderId) throw new AppError('Provide a folioId or posOrderId to invoice.', 422);

    let subtotal = 0;
    // The frontend may or may not know the guest — always resolve it
    // server-side from the folio/order itself so it's never left blank.
    let guestId = req.body.guestId || null;

    if (folioId) {
      const [charges] = await conn.query('SELECT amount FROM folio_charges WHERE folio_id = ?', [folioId]);
      subtotal = charges.reduce((sum, c) => sum + Number(c.amount), 0);
      if (!guestId) {
        const [[folioGuest]] = await conn.query(
          `SELECT s.guest_id FROM folios f JOIN stays s ON s.id = f.stay_id WHERE f.id = ?`,
          [folioId]
        );
        guestId = folioGuest?.guest_id || null;
      }
    } else {
      const [[order]] = await conn.query('SELECT subtotal, guest_id FROM pos_orders WHERE id = ?', [posOrderId]);
      if (!order) throw new AppError('POS order not found.', 404);
      subtotal = Number(order.subtotal);
      if (!guestId) guestId = order.guest_id || null;
    }

    const taxAmount = money(subtotal * (taxPercent / 100));
    const serviceCharge = money(subtotal * (serviceChargePercent / 100));
    const total = money(subtotal + taxAmount + serviceCharge - discountAmount);
    const invoiceNumber = generateNumber('INV');

    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO invoices
       (invoice_number, folio_id, pos_order_id, guest_id, subtotal, tax_amount, service_charge, discount_amount, total_amount, balance_due, currency_code, issued_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [invoiceNumber, folioId || null, posOrderId || null, guestId, money(subtotal), taxAmount, serviceCharge, discountAmount, total, total, currencyCode || 'USD', req.user.id]
    );
    await conn.commit();
    res.status(201).json({ id: result.insertId, invoiceNumber, total });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

/* -------------------------------- Payments --------------------------------- */

// POST /api/billing/payments  { invoiceId, method, amount, currencyCode, transactionRef, gatewayResponse }
router.post('/payments', authorize('billing', 'write'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { invoiceId, method, amount, currencyCode, transactionRef, gatewayResponse } = req.body;
    const validMethods = ['cash', 'card', 'bank_transfer', 'mobile_money', 'paystack', 'stripe', 'flutterwave', 'credit'];
    if (!invoiceId || !validMethods.includes(method) || !amount) {
      throw new AppError('Invoice, a valid payment method and amount are required.', 422);
    }

    const [[invoice]] = await conn.query('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [invoiceId]);
    if (!invoice) throw new AppError('Invoice not found.', 404);
    if (invoice.status === 'paid') throw new AppError('This invoice is already fully paid.', 409);

    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO payments (invoice_id, method, amount, currency_code, transaction_ref, gateway_response, received_by)
       VALUES (?,?,?,?,?,?,?)`,
      [invoiceId, method, amount, currencyCode || invoice.currency_code, transactionRef || null, JSON.stringify(gatewayResponse || null), req.user.id]
    );

    const newPaid = money(Number(invoice.amount_paid) + Number(amount));
    const newBalance = money(Number(invoice.total_amount) - newPaid);
    const status = newBalance <= 0.01 ? 'paid' : 'partial';

    await conn.query('UPDATE invoices SET amount_paid = ?, balance_due = ?, status = ? WHERE id = ?', [newPaid, Math.max(newBalance, 0), status, invoiceId]);
    await conn.commit();

    // Fire-and-forget receipt email — never block or fail the payment on email issues.
    (async () => {
      try {
        const guestId = invoice.guest_id;
        if (!guestId) return;
        const [[guest]] = await pool.query('SELECT first_name, last_name, email FROM guests WHERE id = ?', [guestId]);
        if (!guest?.email) return;
        const settings = await getHotelSettings();
        const [[freshInvoice]] = await pool.query('SELECT invoice_number, total_amount FROM invoices WHERE id = ?', [invoiceId]);
        const { subject, html } = invoiceReceiptEmail({
          hotelName: settings.hotel_name,
          guestName: `${guest.first_name} ${guest.last_name}`,
          invoiceNumber: freshInvoice.invoice_number,
          totalAmount: freshInvoice.total_amount,
          amountPaid: newPaid,
          balanceDue: Math.max(newBalance, 0),
          method,
          formatMoney: (v) => formatCurrency(v, settings)
        });
        await sendMail({ to: guest.email, subject, html });
      } catch (emailErr) {
        require('../utils/logger').error(`Receipt email failed: ${emailErr.message}`);
      }
    })();

    res.status(201).json({ message: 'Payment recorded.', status, balanceDue: Math.max(newBalance, 0) });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

router.patch('/invoices/:id/void', authorize('billing', 'write'), async (req, res, next) => {
  try {
    await pool.query('UPDATE invoices SET status = "void" WHERE id = ?', [req.params.id]);
    res.json({ message: 'Invoice voided.' });
  } catch (err) { next(err); }
});

module.exports = router;