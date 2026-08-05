const express = require('express');
const { pool } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { paginationParams } = require('../utils/helpers');

const router = express.Router();
router.use(authenticate);

// GET /api/guests?q=&vip=&page=
router.get('/', async (req, res, next) => {
  try {
    const { q, vip } = req.query;
    const { page, limit, offset } = paginationParams(req.query);
    const where = []; const params = [];
    if (q) { where.push('(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
    if (vip) { where.push('vip_tier = ?'); params.push(vip); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(`SELECT * FROM guests ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM guests ${whereSql}`, params);
    res.json({ data: rows, page, limit, total: count.total });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [[guest]] = await pool.query('SELECT * FROM guests WHERE id = ?', [req.params.id]);
    if (!guest) throw new AppError('Guest not found.', 404);

    const [stayHistory] = await pool.query(
      `SELECT s.*, r.room_number, res.check_in_date, res.check_out_date
       FROM stays s JOIN rooms r ON r.id = s.room_id JOIN reservations res ON res.id = s.reservation_id
       WHERE s.guest_id = ? ORDER BY s.actual_check_in DESC`,
      [req.params.id]
    );
    const [notes] = await pool.query(
      `SELECT n.*, u.full_name AS author FROM guest_notes n LEFT JOIN users u ON u.id = n.user_id
       WHERE guest_id = ? ORDER BY n.created_at DESC`,
      [req.params.id]
    );
    const [[spend]] = await pool.query(
      `SELECT COALESCE(SUM(i.total_amount),0) AS lifetime_spend FROM invoices i WHERE i.guest_id = ? AND i.status = 'paid'`,
      [req.params.id]
    );

    res.json({ ...guest, stayHistory, notes, lifetimeSpend: spend.lifetime_spend });
  } catch (err) { next(err); }
});

router.post('/', authorize('crm', 'write'), async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, idType, idNumber, nationality, address, city, country, dateOfBirth, preferences } = req.body;
    if (!firstName || !lastName) throw new AppError('First and last name are required.', 422);
    const [result] = await pool.query(
      `INSERT INTO guests (first_name, last_name, email, phone, id_type, id_number, nationality, address, city, country, date_of_birth, preferences)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [firstName, lastName, email || null, phone || null, idType || null, idNumber || null, nationality || null,
       address || null, city || null, country || null, dateOfBirth || null, JSON.stringify(preferences || {})]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { next(err); }
});

router.put('/:id', authorize('crm', 'write'), async (req, res, next) => {
  try {
    const map = {
      firstName: 'first_name', lastName: 'last_name', email: 'email', phone: 'phone', idType: 'id_type',
      idNumber: 'id_number', nationality: 'nationality', address: 'address', city: 'city', country: 'country',
      dateOfBirth: 'date_of_birth', vipTier: 'vip_tier', blacklisted: 'blacklisted', notes: 'notes'
    };
    const updates = []; const values = [];
    Object.keys(req.body).forEach((k) => {
      if (map[k]) { updates.push(`${map[k]} = ?`); values.push(req.body[k]); }
    });
    if (!updates.length) throw new AppError('No valid fields to update.', 422);
    values.push(req.params.id);
    await pool.query(`UPDATE guests SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Guest profile updated.' });
  } catch (err) { next(err); }
});

router.post('/:id/notes', authorize('crm', 'write'), async (req, res, next) => {
  try {
    const { note } = req.body;
    if (!note) throw new AppError('Note text is required.', 422);
    await pool.query('INSERT INTO guest_notes (guest_id, user_id, note) VALUES (?,?,?)', [req.params.id, req.user.id, note]);
    res.status(201).json({ message: 'Note added.' });
  } catch (err) { next(err); }
});

router.post('/:id/loyalty-points', authorize('crm', 'write'), async (req, res, next) => {
  try {
    const { points } = req.body;
    if (points === undefined) throw new AppError('Points value is required.', 422);
    await pool.query('UPDATE guests SET loyalty_points = loyalty_points + ? WHERE id = ?', [points, req.params.id]);
    res.json({ message: 'Loyalty points updated.' });
  } catch (err) { next(err); }
});

module.exports = router;
