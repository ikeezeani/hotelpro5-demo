const express = require('express');
const { pool } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { money } = require('../utils/helpers');

const router = express.Router();
router.use(authenticate, authorize('reports', 'read'));

function dateRange(query) {
  const to = query.to || new Date().toISOString().slice(0, 10);
  const from = query.from || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

// GET /api/reports/occupancy?from=&to=
router.get('/occupancy', async (req, res, next) => {
  try {
    const { from, to } = dateRange(req.query);
    const [[totalRooms]] = await pool.query('SELECT COUNT(*) AS total FROM rooms WHERE status != "out_of_order"');
    const [rows] = await pool.query(
      `SELECT DATE(s.actual_check_in) AS date, COUNT(DISTINCT s.room_id) AS rooms_sold
       FROM stays s WHERE s.actual_check_in BETWEEN ? AND ?
       GROUP BY DATE(s.actual_check_in) ORDER BY date`,
      [`${from} 00:00:00`, `${to} 23:59:59`]
    );
    const data = rows.map((r) => ({
      date: r.date,
      roomsSold: r.rooms_sold,
      occupancyRate: totalRooms.total ? money((r.rooms_sold / totalRooms.total) * 100) : 0
    }));
    res.json({ totalRooms: totalRooms.total, data });
  } catch (err) { next(err); }
});

// GET /api/reports/revenue?from=&to=  — room revenue, POS revenue, ADR, RevPAR
router.get('/revenue', async (req, res, next) => {
  try {
    const { from, to } = dateRange(req.query);

    const [[roomRevenue]] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM folio_charges fc
       JOIN folios f ON f.id = fc.folio_id
       WHERE fc.charge_type = 'room' AND fc.created_at BETWEEN ? AND ?`,
      [`${from} 00:00:00`, `${to} 23:59:59`]
    );
    const [[posRevenue]] = await pool.query(
      `SELECT COALESCE(SUM(total_amount),0) AS total FROM pos_orders
       WHERE status IN ('paid','charged_to_room') AND created_at BETWEEN ? AND ?`,
      [`${from} 00:00:00`, `${to} 23:59:59`]
    );
    const [[roomNights]] = await pool.query(
      `SELECT COUNT(*) AS nights FROM stays WHERE actual_check_in BETWEEN ? AND ?`,
      [`${from} 00:00:00`, `${to} 23:59:59`]
    );
    const [[totalRooms]] = await pool.query('SELECT COUNT(*) AS total FROM rooms WHERE status != "out_of_order"');

    const days = Math.max(Math.round((new Date(to) - new Date(from)) / 86400000) + 1, 1);
    const adr = roomNights.nights ? money(roomRevenue.total / roomNights.nights) : 0;
    const revPar = totalRooms.total ? money(roomRevenue.total / (totalRooms.total * days)) : 0;

    res.json({
      period: { from, to },
      roomRevenue: money(roomRevenue.total),
      posRevenue: money(posRevenue.total),
      totalRevenue: money(Number(roomRevenue.total) + Number(posRevenue.total)),
      adr,
      revPar
    });
  } catch (err) { next(err); }
});

// GET /api/reports/pos-sales?from=&to=&outletId=
router.get('/pos-sales', async (req, res, next) => {
  try {
    const { from, to } = dateRange(req.query);
    const { outletId } = req.query;
    const params = [`${from} 00:00:00`, `${to} 23:59:59`];
    let outletFilter = '';
    if (outletId) { outletFilter = 'AND o.outlet_id = ?'; params.push(outletId); }

    const [byOutlet] = await pool.query(
      `SELECT po.name AS outlet, COUNT(o.id) AS orders, COALESCE(SUM(o.total_amount),0) AS revenue
       FROM pos_orders o JOIN pos_outlets po ON po.id = o.outlet_id
       WHERE o.created_at BETWEEN ? AND ? AND o.status IN ('paid','charged_to_room') ${outletFilter}
       GROUP BY po.id ORDER BY revenue DESC`,
      params
    );
    const [topItems] = await pool.query(
      `SELECT oi.name, SUM(oi.quantity) AS qty_sold, SUM(oi.line_total) AS revenue
       FROM pos_order_items oi JOIN pos_orders o ON o.id = oi.order_id
       WHERE o.created_at BETWEEN ? AND ? AND o.status IN ('paid','charged_to_room') ${outletFilter}
       GROUP BY oi.name ORDER BY revenue DESC LIMIT 10`,
      params
    );
    res.json({ period: { from, to }, byOutlet, topItems });
  } catch (err) { next(err); }
});

// GET /api/reports/inventory — low stock + valuation
router.get('/inventory', async (req, res, next) => {
  try {
    const [lowStock] = await pool.query(
      'SELECT id, name, quantity_on_hand, reorder_level, unit FROM inventory_items WHERE quantity_on_hand <= reorder_level'
    );
    const [[valuation]] = await pool.query('SELECT COALESCE(SUM(quantity_on_hand * unit_cost),0) AS total_value FROM inventory_items');
    res.json({ lowStock, totalInventoryValue: money(valuation.total_value) });
  } catch (err) { next(err); }
});

// GET /api/reports/housekeeping — task completion stats
router.get('/housekeeping', async (req, res, next) => {
  try {
    const { from, to } = dateRange(req.query);
    const [rows] = await pool.query(
      `SELECT status, COUNT(*) AS count FROM housekeeping_tasks
       WHERE created_at BETWEEN ? AND ? GROUP BY status`,
      [`${from} 00:00:00`, `${to} 23:59:59`]
    );
    res.json({ period: { from, to }, byStatus: rows });
  } catch (err) { next(err); }
});

// GET /api/reports/guests — new vs returning, top spenders
router.get('/guests', async (req, res, next) => {
  try {
    const [[newGuests]] = await pool.query(
      'SELECT COUNT(*) AS count FROM guests WHERE created_at BETWEEN ? AND ?',
      [`${dateRange(req.query).from} 00:00:00`, `${dateRange(req.query).to} 23:59:59`]
    );
    const [topSpenders] = await pool.query(
      `SELECT g.id, g.first_name, g.last_name, COALESCE(SUM(i.total_amount),0) AS total_spend
       FROM guests g JOIN invoices i ON i.guest_id = g.id AND i.status = 'paid'
       GROUP BY g.id ORDER BY total_spend DESC LIMIT 10`
    );
    res.json({ newGuests: newGuests.count, topSpenders });
  } catch (err) { next(err); }
});

module.exports = router;
