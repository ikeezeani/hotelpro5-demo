const express = require('express');
const { pool } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { generateCode, paginationParams, nightsBetween, formatCurrency } = require('../utils/helpers');
const { sendMail } = require('../utils/mailer');
const { bookingConfirmationEmail } = require('../utils/emailTemplates');
const { getHotelSettings } = require('../utils/hotelSettings');

const router = express.Router();
router.use(authenticate);

// GET /api/reservations?status=&from=&to=&page=&limit=
router.get('/', async (req, res, next) => {
  try {
    const { status, from, to, q } = req.query;
    const { page, limit, offset } = paginationParams(req.query);
    const where = [];
    const params = [];
    if (status) { where.push('res.status = ?'); params.push(status); }
    if (from) { where.push('res.check_in_date >= ?'); params.push(from); }
    if (to) { where.push('res.check_out_date <= ?'); params.push(to); }
    if (q) {
      where.push('(g.first_name LIKE ? OR g.last_name LIKE ? OR res.confirmation_code LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT res.*, g.first_name, g.last_name, g.phone, g.email, rt.name AS room_type_name, r.room_number
       FROM reservations res
       JOIN guests g ON g.id = res.guest_id
       JOIN room_types rt ON rt.id = res.room_type_id
       LEFT JOIN rooms r ON r.id = res.room_id
       ${whereSql}
       ORDER BY res.check_in_date DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[count]] = await pool.query(
      `SELECT COUNT(*) AS total FROM reservations res JOIN guests g ON g.id = res.guest_id ${whereSql}`,
      params
    );
    res.json({ data: rows, page, limit, total: count.total });
  } catch (err) { next(err); }
});

// GET /api/reservations/availability?roomTypeId=&checkIn=&checkOut=
router.get('/availability', async (req, res, next) => {
  try {
    const { roomTypeId, checkIn, checkOut } = req.query;
    if (!roomTypeId || !checkIn || !checkOut) throw new AppError('roomTypeId, checkIn and checkOut are required.', 422);

    const [[totalRooms]] = await pool.query(
      'SELECT COUNT(*) AS total FROM rooms WHERE room_type_id = ? AND status != "out_of_order"',
      [roomTypeId]
    );
    const [[booked]] = await pool.query(
      `SELECT COUNT(*) AS booked FROM reservations
       WHERE room_type_id = ? AND status IN ('booked','confirmed','checked_in')
       AND NOT (check_out_date <= ? OR check_in_date >= ?)`,
      [roomTypeId, checkIn, checkOut]
    );
    const available = totalRooms.total - booked.booked;
    res.json({ totalRooms: totalRooms.total, booked: booked.booked, available: Math.max(available, 0) });
  } catch (err) { next(err); }
});

// POST /api/reservations
router.post('/', authorize('reservations', 'write'), async (req, res, next) => {
  try {
    const {
      guestId, newGuest, roomTypeId, checkInDate, checkOutDate,
      adults, children, ratePerNight, source, specialRequests
    } = req.body;

    if (!roomTypeId || !checkInDate || !checkOutDate) {
      throw new AppError('Room type, check-in and check-out dates are required.', 422);
    }
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      throw new AppError('Check-out date must be after check-in date.', 422);
    }

    let finalGuestId = guestId;
    if (!finalGuestId && newGuest) {
      const [g] = await pool.query(
        `INSERT INTO guests (first_name, last_name, email, phone) VALUES (?,?,?,?)`,
        [newGuest.firstName, newGuest.lastName, newGuest.email || null, newGuest.phone || null]
      );
      finalGuestId = g.insertId;
    }
    if (!finalGuestId) throw new AppError('A guest (existing or new) is required.', 422);

    let rate = ratePerNight;
    if (!rate) {
      const [[rt]] = await pool.query('SELECT base_rate FROM room_types WHERE id = ?', [roomTypeId]);
      if (!rt) throw new AppError('Room type not found.', 404);
      rate = rt.base_rate;
    }

    const code = generateCode('RES');
    const [result] = await pool.query(
      `INSERT INTO reservations
       (confirmation_code, guest_id, room_type_id, source, check_in_date, check_out_date,
        adults, children, rate_per_night, special_requests, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        code, finalGuestId, roomTypeId, source || 'walk_in', checkInDate, checkOutDate,
        adults || 1, children || 0, rate, specialRequests || null, req.user.id
      ]
    );

    // Fire-and-forget confirmation email — never block or fail the reservation on email issues.
    (async () => {
      try {
        const [[guest]] = await pool.query('SELECT first_name, last_name, email FROM guests WHERE id = ?', [finalGuestId]);
        const [[roomType]] = await pool.query('SELECT name FROM room_types WHERE id = ?', [roomTypeId]);
        if (guest?.email) {
          const settings = await getHotelSettings();
          const nights = nightsBetween(checkInDate, checkOutDate);
          const { subject, html } = bookingConfirmationEmail({
            hotelName: settings.hotel_name,
            guestName: `${guest.first_name} ${guest.last_name}`,
            confirmationCode: code,
            roomTypeName: roomType?.name || 'Room',
            checkInDate, checkOutDate, ratePerNight: rate, nights,
            formatMoney: (v) => formatCurrency(v, settings)
          });
          await sendMail({ to: guest.email, subject, html });
        }
      } catch (emailErr) {
        require('../utils/logger').error(`Booking confirmation email failed: ${emailErr.message}`);
      }
    })();

    res.status(201).json({ id: result.insertId, confirmationCode: code, nights: nightsBetween(checkInDate, checkOutDate) });
  } catch (err) { next(err); }
});

// PATCH /api/reservations/:id/status
router.patch('/:id/status', authorize('reservations', 'write'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['booked', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];
    if (!valid.includes(status)) throw new AppError('Invalid reservation status.', 422);
    await pool.query('UPDATE reservations SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Reservation status updated.' });
  } catch (err) { next(err); }
});

// PUT /api/reservations/:id
router.put('/:id', authorize('reservations', 'write'), async (req, res, next) => {
  try {
    const fields = ['check_in_date', 'check_out_date', 'adults', 'children', 'rate_per_night', 'special_requests', 'room_type_id'];
    const updates = [];
    const values = [];
    fields.forEach((f) => {
      const camel = f.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (req.body[camel] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[camel]); }
    });
    if (!updates.length) throw new AppError('No valid fields to update.', 422);
    values.push(req.params.id);
    await pool.query(`UPDATE reservations SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Reservation updated.' });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [[row]] = await pool.query(
      `SELECT res.*, g.first_name, g.last_name, g.phone, g.email, rt.name AS room_type_name
       FROM reservations res JOIN guests g ON g.id = res.guest_id JOIN room_types rt ON rt.id = res.room_type_id
       WHERE res.id = ?`,
      [req.params.id]
    );
    if (!row) throw new AppError('Reservation not found.', 404);
    res.json(row);
  } catch (err) { next(err); }
});

module.exports = router;
