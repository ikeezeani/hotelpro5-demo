const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { money } = require('../utils/helpers');

const router = express.Router();
router.use(authenticate);

// GET /api/dashboard — key metrics for the landing screen
router.get('/', async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [[rooms]] = await pool.query(
      `SELECT COUNT(*) AS total, SUM(status='occupied') AS occupied, SUM(status='available') AS available,
              SUM(status='maintenance') AS maintenance
       FROM rooms`
    );
    const [[arrivals]] = await pool.query(
      `SELECT COUNT(*) AS count FROM reservations WHERE check_in_date = ? AND status IN ('booked','confirmed')`,
      [today]
    );
    const [[departures]] = await pool.query(
      `SELECT COUNT(*) AS count FROM stays s JOIN reservations r ON r.id = s.reservation_id
       WHERE r.check_out_date = ? AND s.status = 'in_house'`,
      [today]
    );
    const [[revenueToday]] = await pool.query(
      `SELECT COALESCE(SUM(amount_paid),0) AS total FROM invoices WHERE DATE(created_at) = ?`,
      [today]
    );
    const [[pendingHousekeeping]] = await pool.query(
      `SELECT COUNT(*) AS count FROM housekeeping_tasks WHERE status IN ('pending','in_progress')`
    );
    const [[lowStock]] = await pool.query(
      `SELECT COUNT(*) AS count FROM inventory_items WHERE quantity_on_hand <= reorder_level`
    );
    const [[openInvoices]] = await pool.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(balance_due),0) AS total FROM invoices WHERE status IN ('unpaid','partial')`
    );

    res.json({
      rooms: {
        total: rooms.total,
        occupied: rooms.occupied || 0,
        available: rooms.available || 0,
        maintenance: rooms.maintenance || 0,
        occupancyRate: rooms.total ? money(((rooms.occupied || 0) / rooms.total) * 100) : 0
      },
      arrivalsToday: arrivals.count,
      departuresToday: departures.count,
      revenueToday: money(revenueToday.total),
      pendingHousekeepingTasks: pendingHousekeeping.count,
      lowStockItems: lowStock.count,
      outstandingInvoices: { count: openInvoices.count, total: money(openInvoices.total) }
    });
  } catch (err) { next(err); }
});

module.exports = router;
