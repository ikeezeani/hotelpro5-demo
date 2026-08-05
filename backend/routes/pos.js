const express = require('express');
const { pool } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { generateNumber, money } = require('../utils/helpers');

const router = express.Router();
router.use(authenticate);

/* -------------------------------- Outlets -------------------------------- */
router.get('/outlets', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM pos_outlets ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/outlets', authorize('pos', 'write'), async (req, res, next) => {
  try {
    const { name, type } = req.body;
    if (!name) throw new AppError('Outlet name is required.', 422);
    const [result] = await pool.query('INSERT INTO pos_outlets (name, type) VALUES (?,?)', [name, type || 'other']);
    res.status(201).json({ id: result.insertId });
  } catch (err) { next(err); }
});

/* -------------------------------- Orders --------------------------------- */

router.get('/orders', async (req, res, next) => {
  try {
    const { status, outletId } = req.query;
    const where = []; const params = [];
    if (status) { where.push('o.status = ?'); params.push(status); }
    if (outletId) { where.push('o.outlet_id = ?'); params.push(outletId); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT o.*, po.name AS outlet_name, g.first_name, g.last_name
       FROM pos_orders o JOIN pos_outlets po ON po.id = o.outlet_id
       LEFT JOIN guests g ON g.id = o.guest_id
       ${whereSql} ORDER BY o.created_at DESC LIMIT 200`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/orders/:id', async (req, res, next) => {
  try {
    const [[order]] = await pool.query('SELECT * FROM pos_orders WHERE id = ?', [req.params.id]);
    if (!order) throw new AppError('Order not found.', 404);
    const [items] = await pool.query('SELECT * FROM pos_order_items WHERE order_id = ?', [req.params.id]);
    res.json({ ...order, items });
  } catch (err) { next(err); }
});

// POST /api/pos/orders  { outletId, guestId?, stayId?, items:[{itemId?, name, quantity, unitPrice}] }
router.post('/orders', authorize('pos', 'write'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { outletId, guestId, stayId, items, taxPercent = 0, serviceChargePercent = 0, discountAmount = 0 } = req.body;
    if (!outletId || !Array.isArray(items) || !items.length) {
      throw new AppError('Outlet and at least one order item are required.', 422);
    }

    const subtotal = money(items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0));
    const taxAmount = money(subtotal * (taxPercent / 100));
    const serviceCharge = money(subtotal * (serviceChargePercent / 100));
    const total = money(subtotal + taxAmount + serviceCharge - discountAmount);
    const orderNumber = generateNumber('POS');

    await conn.beginTransaction();
    const [order] = await conn.query(
      `INSERT INTO pos_orders
       (order_number, outlet_id, guest_id, stay_id, subtotal, tax_amount, service_charge, discount_amount, total_amount, opened_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [orderNumber, outletId, guestId || null, stayId || null, subtotal, taxAmount, serviceCharge, discountAmount, total, req.user.id]
    );

    for (const it of items) {
      const lineTotal = money(it.quantity * it.unitPrice);
      await conn.query(
        `INSERT INTO pos_order_items (order_id, item_id, name, quantity, unit_price, line_total)
         VALUES (?,?,?,?,?,?)`,
        [order.insertId, it.itemId || null, it.name, it.quantity, it.unitPrice, lineTotal]
      );
      // Decrement inventory automatically for sellable stock items
      if (it.itemId) {
        await conn.query('UPDATE inventory_items SET quantity_on_hand = quantity_on_hand - ? WHERE id = ?', [it.quantity, it.itemId]);
        await conn.query(
          `INSERT INTO inventory_transactions (item_id, type, quantity, reference, user_id)
           VALUES (?, 'pos_sale_out', ?, ?, ?)`,
          [it.itemId, -Math.abs(it.quantity), orderNumber, req.user.id]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ id: order.insertId, orderNumber, subtotal, taxAmount, serviceCharge, total });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// POST /api/pos/orders/:id/charge-to-room — pushes the POS total onto the guest's open folio
router.post('/orders/:id/charge-to-room', authorize('pos', 'write'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const [[order]] = await conn.query('SELECT * FROM pos_orders WHERE id = ?', [req.params.id]);
    if (!order) throw new AppError('Order not found.', 404);
    if (!order.stay_id) throw new AppError('This order is not linked to an in-house stay.', 422);

    const [[folio]] = await conn.query('SELECT * FROM folios WHERE stay_id = ? AND status = "open"', [order.stay_id]);
    if (!folio) throw new AppError('No open folio found for this stay.', 404);

    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO folio_charges (folio_id, charge_type, description, reference_table, reference_id, amount)
       VALUES (?, 'pos', ?, 'pos_orders', ?, ?)`,
      [folio.id, `POS charge — order ${order.order_number}`, order.id, order.total_amount]
    );
    await conn.query('UPDATE pos_orders SET status = "charged_to_room", closed_by = ?, closed_at = NOW() WHERE id = ?', [req.user.id, order.id]);
    await conn.commit();
    res.json({ message: 'Charged to room folio.' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

router.patch('/orders/:id/void', authorize('pos', 'write'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const [[order]] = await conn.query('SELECT * FROM pos_orders WHERE id = ?', [req.params.id]);
    if (!order) throw new AppError('Order not found.', 404);
    if (order.status === 'void') throw new AppError('This order is already voided.', 409);

    const [items] = await conn.query('SELECT * FROM pos_order_items WHERE order_id = ?', [req.params.id]);

    await conn.beginTransaction();
    for (const item of items) {
      if (item.item_id) {
        await conn.query('UPDATE inventory_items SET quantity_on_hand = quantity_on_hand + ? WHERE id = ?', [item.quantity, item.item_id]);
        await conn.query(
          `INSERT INTO inventory_transactions (item_id, type, quantity, reference, user_id, notes)
           VALUES (?, 'adjustment', ?, ?, ?, 'Stock restored — order voided')`,
          [item.item_id, item.quantity, order.order_number, req.user.id]
        );
      }
    }
    await conn.query('UPDATE pos_orders SET status = "void", closed_by = ?, closed_at = NOW() WHERE id = ?', [req.user.id, req.params.id]);
    await conn.commit();
    res.json({ message: 'Order voided and stock restored.' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
