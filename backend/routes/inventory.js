const express = require('express');
const { pool } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { generateNumber } = require('../utils/helpers');
const { runLowStockDigest } = require('../jobs/lowStockDigest');

const router = express.Router();
router.use(authenticate);

/* ------------------------------ Categories ----------------------------- */
router.get('/categories', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM inventory_categories ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/categories', authorize('inventory', 'write'), async (req, res, next) => {
  try {
    const { name, department } = req.body;
    if (!name) throw new AppError('Category name is required.', 422);
    const [result] = await pool.query('INSERT INTO inventory_categories (name, department) VALUES (?,?)', [name, department || 'other']);
    res.status(201).json({ id: result.insertId });
  } catch (err) { next(err); }
});

/* -------------------------------- Items -------------------------------- */
router.get('/items', async (req, res, next) => {
  try {
    const { lowStock, sellable, q } = req.query;
    const where = [];
    const params = [];
    if (lowStock === 'true') where.push('i.quantity_on_hand <= i.reorder_level');
    if (sellable === 'true') where.push('i.is_sellable = 1');
    if (q) { where.push('i.name LIKE ?'); params.push(`%${q}%`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT i.*, c.name AS category_name FROM inventory_items i
       LEFT JOIN inventory_categories c ON c.id = i.category_id
       ${whereSql} ORDER BY i.name`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/items', authorize('inventory', 'write'), async (req, res, next) => {
  try {
    const { categoryId, sku, name, unit, quantityOnHand, reorderLevel, unitCost, isSellable, sellingPrice } = req.body;
    if (!name) throw new AppError('Item name is required.', 422);
    const [result] = await pool.query(
      `INSERT INTO inventory_items
       (category_id, sku, name, unit, quantity_on_hand, reorder_level, unit_cost, is_sellable, selling_price)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [categoryId || null, sku || null, name, unit || 'pcs', quantityOnHand || 0, reorderLevel || 0,
       unitCost || 0, isSellable ? 1 : 0, sellingPrice || 0]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { next(err); }
});

router.put('/items/:id', authorize('inventory', 'write'), async (req, res, next) => {
  try {
    const fields = ['category_id', 'sku', 'name', 'unit', 'reorder_level', 'unit_cost', 'is_sellable', 'selling_price'];
    const map = { categoryId: 'category_id', reorderLevel: 'reorder_level', unitCost: 'unit_cost', isSellable: 'is_sellable', sellingPrice: 'selling_price' };
    const updates = []; const values = [];
    Object.keys(req.body).forEach((k) => {
      const col = map[k] || (fields.includes(k) ? k : null);
      if (col) { updates.push(`${col} = ?`); values.push(req.body[k]); }
    });
    if (!updates.length) throw new AppError('No valid fields to update.', 422);
    values.push(req.params.id);
    await pool.query(`UPDATE inventory_items SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Item updated.' });
  } catch (err) { next(err); }
});

/* --------------------------- Stock Transactions -------------------------- */

// POST /api/inventory/transactions — record stock in/out/adjustment
router.post('/transactions', authorize('inventory', 'write'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { itemId, type, quantity, reference, notes } = req.body;
    const validTypes = ['purchase_in', 'usage_out', 'adjustment', 'pos_sale_out', 'transfer'];
    if (!itemId || !validTypes.includes(type) || !quantity) {
      throw new AppError('Item, valid type and quantity are required.', 422);
    }
    const signedQty = ['usage_out', 'pos_sale_out'].includes(type) ? -Math.abs(quantity) : Math.abs(quantity);

    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO inventory_transactions (item_id, type, quantity, reference, user_id, notes)
       VALUES (?,?,?,?,?,?)`,
      [itemId, type, signedQty, reference || null, req.user.id, notes || null]
    );
    await conn.query('UPDATE inventory_items SET quantity_on_hand = quantity_on_hand + ? WHERE id = ?', [signedQty, itemId]);
    await conn.commit();
    res.status(201).json({ message: 'Stock transaction recorded.' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

router.get('/transactions', async (req, res, next) => {
  try {
    const { itemId } = req.query;
    const where = itemId ? 'WHERE t.item_id = ?' : '';
    const params = itemId ? [itemId] : [];
    const [rows] = await pool.query(
      `SELECT t.*, i.name AS item_name, u.full_name AS user_name
       FROM inventory_transactions t
       JOIN inventory_items i ON i.id = t.item_id
       LEFT JOIN users u ON u.id = t.user_id
       ${where} ORDER BY t.created_at DESC LIMIT 200`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

/* ------------------------------- Suppliers ------------------------------- */
router.get('/suppliers', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY name');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/suppliers', authorize('inventory', 'write'), async (req, res, next) => {
  try {
    const { name, contactPerson, phone, email, address } = req.body;
    if (!name) throw new AppError('Supplier name is required.', 422);
    const [result] = await pool.query(
      'INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?,?,?,?,?)',
      [name, contactPerson || null, phone || null, email || null, address || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { next(err); }
});

/* ---------------------------- Purchase Orders ----------------------------- */

router.get('/purchase-orders', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT po.*, s.name AS supplier_name FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id ORDER BY po.created_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/inventory/purchase-orders  { supplierId, items:[{itemId, quantity, unitCost}] }
router.post('/purchase-orders', authorize('inventory', 'write'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { supplierId, items } = req.body;
    if (!Array.isArray(items) || !items.length) throw new AppError('At least one line item is required.', 422);

    const total = items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);
    const poNumber = generateNumber('PO');

    await conn.beginTransaction();
    const [po] = await conn.query(
      `INSERT INTO purchase_orders (po_number, supplier_id, total_amount, ordered_by, status)
       VALUES (?,?,?,?,'ordered')`,
      [poNumber, supplierId || null, total, req.user.id]
    );
    for (const it of items) {
      await conn.query(
        `INSERT INTO purchase_order_items (purchase_order_id, item_id, quantity, unit_cost) VALUES (?,?,?,?)`,
        [po.insertId, it.itemId, it.quantity, it.unitCost]
      );
    }
    await conn.commit();
    res.status(201).json({ id: po.insertId, poNumber });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// POST /api/inventory/purchase-orders/:id/receive — marks received & updates stock
router.post('/purchase-orders/:id/receive', authorize('inventory', 'write'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const [items] = await conn.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [req.params.id]);
    if (!items.length) throw new AppError('Purchase order has no items.', 404);

    await conn.beginTransaction();
    for (const it of items) {
      await conn.query('UPDATE inventory_items SET quantity_on_hand = quantity_on_hand + ?, unit_cost = ? WHERE id = ?', [it.quantity, it.unit_cost, it.item_id]);
      await conn.query(
        `INSERT INTO inventory_transactions (item_id, type, quantity, reference, user_id)
         VALUES (?, 'purchase_in', ?, ?, ?)`,
        [it.item_id, it.quantity, `PO#${req.params.id}`, req.user.id]
      );
    }
    await conn.query('UPDATE purchase_orders SET status = "received", received_at = NOW() WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json({ message: 'Purchase order received and stock updated.' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// POST /api/inventory/low-stock-digest/send-now — lets an admin/manager trigger the
// daily digest email immediately (e.g. to verify SMTP is working) instead of waiting for the schedule.
router.post('/low-stock-digest/send-now', authorize('inventory', 'write'), async (req, res, next) => {
  try {
    await runLowStockDigest();
    res.json({ message: 'Low stock digest run — check your email if SMTP is configured and any items are low.' });
  } catch (err) { next(err); }
});

module.exports = router;
