const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { generateNumber } = require('../utils/helpers');

const router = express.Router();
router.use(authenticate);

/* ---------------------------- Room Types ---------------------------- */

router.get('/room-types', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM room_types ORDER BY base_rate');
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/room-types', authorize('front_desk', 'write'), async (req, res, next) => {
  try {
    const { name, description, base_rate, max_occupancy, amenities, image_url } = req.body;
    if (!name || base_rate === undefined) throw new AppError('Room type name and base rate are required.', 422);
    const [result] = await pool.query(
      `INSERT INTO room_types (name, description, base_rate, max_occupancy, amenities, image_url)
       VALUES (?,?,?,?,?,?)`,
      [name, description || null, base_rate, max_occupancy || 2, JSON.stringify(amenities || []), image_url || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { next(err); }
});

router.put('/room-types/:id', authorize('front_desk', 'write'), async (req, res, next) => {
  try {
    const map = { name: 'name', description: 'description', base_rate: 'base_rate', max_occupancy: 'max_occupancy', image_url: 'image_url' };
    const updates = []; const values = [];
    Object.keys(req.body).forEach((k) => {
      if (map[k]) { updates.push(`${map[k]} = ?`); values.push(req.body[k]); }
    });
    if (req.body.amenities !== undefined) { updates.push('amenities = ?'); values.push(JSON.stringify(req.body.amenities)); }
    if (!updates.length) throw new AppError('No valid fields to update.', 422);
    values.push(req.params.id);
    await pool.query(`UPDATE room_types SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Room type updated.' });
  } catch (err) { next(err); }
});

router.delete('/room-types/:id', authorize('front_desk', 'write'), async (req, res, next) => {
  try {
    const [[roomCount]] = await pool.query('SELECT COUNT(*) AS count FROM rooms WHERE room_type_id = ?', [req.params.id]);
    if (roomCount.count > 0) {
      throw new AppError('This room type still has rooms assigned to it. Delete or reassign those rooms first.', 409);
    }
    await pool.query('DELETE FROM room_types WHERE id = ?', [req.params.id]);
    res.json({ message: 'Room type deleted.' });
  } catch (err) { next(err); }
});

/* -------------------------------- Rooms ------------------------------ */

// GET /api/front-desk/rooms — room board with live status
router.get('/rooms', async (req, res, next) => {
  try {
    const { status } = req.query;
    let sql = `SELECT r.*, rt.name AS room_type_name, rt.base_rate
               FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id`;
    const params = [];
    if (status) { sql += ' WHERE r.status = ?'; params.push(status); }
    sql += ' ORDER BY r.room_number';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/rooms', authorize('front_desk', 'write'), async (req, res, next) => {
  try {
    const { room_type_id, room_number, floor, notes } = req.body;
    if (!room_type_id || !room_number) throw new AppError('Room type and room number are required.', 422);
    const [result] = await pool.query(
      `INSERT INTO rooms (room_type_id, room_number, floor, notes) VALUES (?,?,?,?)`,
      [room_type_id, room_number, floor || null, notes || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { next(err); }
});

router.put('/rooms/:id', authorize('front_desk', 'write'), async (req, res, next) => {
  try {
    const map = { room_type_id: 'room_type_id', room_number: 'room_number', floor: 'floor', notes: 'notes' };
    const updates = []; const values = [];
    Object.keys(req.body).forEach((k) => {
      if (map[k]) { updates.push(`${map[k]} = ?`); values.push(req.body[k]); }
    });
    if (!updates.length) throw new AppError('No valid fields to update.', 422);
    values.push(req.params.id);
    await pool.query(`UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Room updated.' });
  } catch (err) { next(err); }
});

router.delete('/rooms/:id', authorize('front_desk', 'write'), async (req, res, next) => {
  try {
    const [[room]] = await pool.query('SELECT status FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) throw new AppError('Room not found.', 404);
    if (room.status === 'occupied') throw new AppError('Cannot delete a room that is currently occupied.', 409);
    await pool.query('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    res.json({ message: 'Room deleted.' });
  } catch (err) { next(err); }
});

router.patch('/rooms/:id/status', authorize('front_desk', 'write'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['available', 'occupied', 'reserved', 'maintenance', 'out_of_order'];
    if (!valid.includes(status)) throw new AppError('Invalid room status.', 422);
    await pool.query('UPDATE rooms SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Room status updated.' });
  } catch (err) { next(err); }
});

/* ------------------------------ Check-in ------------------------------ */

// POST /api/front-desk/check-in  { reservationId, roomId }
router.post('/check-in', authorize('front_desk', 'write'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { reservationId, roomId } = req.body;
    if (!reservationId || !roomId) throw new AppError('Reservation and room are required.', 422);

    await conn.beginTransaction();

    const [[reservation]] = await conn.query('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [reservationId]);
    if (!reservation) throw new AppError('Reservation not found.', 404);
    if (reservation.status === 'checked_in') throw new AppError('Guest already checked in.', 409);

    const [[room]] = await conn.query('SELECT * FROM rooms WHERE id = ? FOR UPDATE', [roomId]);
    if (!room) throw new AppError('Room not found.', 404);
    if (room.status === 'occupied') throw new AppError('Room is currently occupied.', 409);

    await conn.query('UPDATE reservations SET status = "checked_in", room_id = ? WHERE id = ?', [roomId, reservationId]);
    await conn.query('UPDATE rooms SET status = "occupied" WHERE id = ?', [roomId]);

    const [stayResult] = await conn.query(
      `INSERT INTO stays (reservation_id, room_id, guest_id, actual_check_in, checked_in_by)
       VALUES (?, ?, ?, NOW(), ?)`,
      [reservationId, roomId, reservation.guest_id, req.user.id]
    );

    const folioNumber = generateNumber('FOL');
    const [folioResult] = await conn.query(
      `INSERT INTO folios (stay_id, folio_number) VALUES (?, ?)`,
      [stayResult.insertId, folioNumber]
    );

    // Seed the folio with the room charge for the full stay
    const nights = Math.max(
      Math.round((new Date(reservation.check_out_date) - new Date(reservation.check_in_date)) / 86400000), 1
    );
    await conn.query(
      `INSERT INTO folio_charges (folio_id, charge_type, description, amount)
       VALUES (?, 'room', ?, ?)`,
      [folioResult.insertId, `Room charge (${nights} night${nights > 1 ? 's' : ''})`, reservation.rate_per_night * nights]
    );

    await conn.commit();
    res.status(201).json({ stayId: stayResult.insertId, folioId: folioResult.insertId, folioNumber });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

/* ------------------------------ Check-out ------------------------------ */

// POST /api/front-desk/check-out  { stayId }
router.post('/check-out', authorize('front_desk', 'write'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { stayId } = req.body;
    const [[stay]] = await conn.query('SELECT * FROM stays WHERE id = ? FOR UPDATE', [stayId]);
    if (!stay) throw new AppError('Stay not found.', 404);
    if (stay.status === 'checked_out') throw new AppError('Guest already checked out.', 409);

    const [[folio]] = await conn.query('SELECT * FROM folios WHERE stay_id = ?', [stayId]);
    const [[balance]] = await conn.query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM folio_charges WHERE folio_id = ?`,
      [folio?.id || 0]
    );
    if (folio) {
      const [[paid]] = await conn.query(
        `SELECT COALESCE(SUM(p.amount),0) AS paid FROM payments p
         JOIN invoices i ON i.id = p.invoice_id WHERE i.folio_id = ? AND p.status = 'completed'`,
        [folio.id]
      );
      if (Number(balance.total) - Number(paid.paid) > 0.01) {
        throw new AppError('Outstanding folio balance must be settled before check-out.', 409);
      }
    }

    await conn.beginTransaction();
    await conn.query(
      'UPDATE stays SET status = "checked_out", actual_check_out = NOW(), checked_out_by = ? WHERE id = ?',
      [req.user.id, stayId]
    );
    await conn.query('UPDATE reservations SET status = "checked_out" WHERE id = ?', [stay.reservation_id]);
    await conn.query('UPDATE rooms SET status = "available", housekeeping_status = "dirty" WHERE id = ?', [stay.room_id]);
    if (folio) await conn.query('UPDATE folios SET status = "closed", closed_at = NOW() WHERE id = ?', [folio.id]);

    // Auto-create a checkout-clean housekeeping task
    await conn.query(
      `INSERT INTO housekeeping_tasks (room_id, task_type, priority) VALUES (?, 'checkout_clean', 'high')`,
      [stay.room_id]
    );

    await conn.commit();
    res.json({ message: 'Guest checked out successfully.' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// GET /api/front-desk/in-house — currently in-house guests
router.get('/in-house', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id AS stay_id, s.actual_check_in, r.room_number, g.first_name, g.last_name, g.phone,
              res.check_out_date, f.id AS folio_id, f.folio_number
       FROM stays s
       JOIN rooms r ON r.id = s.room_id
       JOIN guests g ON g.id = s.guest_id
       JOIN reservations res ON res.id = s.reservation_id
       LEFT JOIN folios f ON f.stay_id = s.id
       WHERE s.status = 'in_house'
       ORDER BY r.room_number`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
