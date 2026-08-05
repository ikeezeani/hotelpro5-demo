const express = require('express');
const { pool } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

// GET /api/housekeeping/tasks?status=&assignedTo=
router.get('/tasks', async (req, res, next) => {
  try {
    const { status, assignedTo } = req.query;
    const where = [];
    const params = [];
    if (status) { where.push('t.status = ?'); params.push(status); }
    if (assignedTo) { where.push('t.assigned_to = ?'); params.push(assignedTo); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT t.*, r.room_number, r.floor, u.full_name AS assigned_to_name
       FROM housekeeping_tasks t
       JOIN rooms r ON r.id = t.room_id
       LEFT JOIN users u ON u.id = t.assigned_to
       ${whereSql}
       ORDER BY FIELD(t.priority,'urgent','high','normal','low'), t.created_at`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/housekeeping/room-status — quick housekeeping board grouped by room
router.get('/room-status', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.room_number, r.floor, r.status AS room_status, r.housekeeping_status
       FROM rooms r ORDER BY r.floor, r.room_number`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/housekeeping/tasks
router.post('/tasks', authorize('housekeeping', 'write'), async (req, res, next) => {
  try {
    const { roomId, taskType, priority, assignedTo, notes } = req.body;
    if (!roomId) throw new AppError('Room is required.', 422);
    const [result] = await pool.query(
      `INSERT INTO housekeeping_tasks (room_id, task_type, priority, assigned_to, notes)
       VALUES (?,?,?,?,?)`,
      [roomId, taskType || 'stay_over_clean', priority || 'normal', assignedTo || null, notes || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) { next(err); }
});

// PATCH /api/housekeeping/tasks/:id — update status/assignment
router.patch('/tasks/:id', authorize('housekeeping', 'write'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { status, assignedTo } = req.body;
    const validStatuses = ['pending', 'in_progress', 'completed', 'verified'];
    if (status && !validStatuses.includes(status)) throw new AppError('Invalid status.', 422);

    await conn.beginTransaction();
    const updates = [];
    const values = [];
    if (status) {
      updates.push('status = ?'); values.push(status);
      if (status === 'in_progress') updates.push('started_at = NOW()');
      if (status === 'completed') updates.push('completed_at = NOW()');
      if (status === 'verified') { updates.push('verified_by = ?'); values.push(req.user.id); }
    }
    if (assignedTo !== undefined) { updates.push('assigned_to = ?'); values.push(assignedTo); }
    values.push(req.params.id);
    await conn.query(`UPDATE housekeeping_tasks SET ${updates.join(', ')} WHERE id = ?`, values);

    if (status === 'verified') {
      const [[task]] = await conn.query('SELECT room_id FROM housekeeping_tasks WHERE id = ?', [req.params.id]);
      await conn.query('UPDATE rooms SET housekeeping_status = "clean" WHERE id = ?', [task.room_id]);
    }
    await conn.commit();
    res.json({ message: 'Task updated.' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
