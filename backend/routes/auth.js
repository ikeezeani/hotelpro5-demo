const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });
}

// POST /api/auth/login
router.post(
  '/login',
  [body('username').notEmpty(), body('password').notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError('Username and password are required.', 422);

      const { username, password } = req.body;
      const [rows] = await pool.query(
        `SELECT u.*, r.name AS role, r.permissions FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.username = ? OR u.email = ? LIMIT 1`,
        [username, username]
      );
      const user = rows[0];
      if (!user) throw new AppError('Invalid credentials.', 401);
      if (user.status !== 'active') throw new AppError('This account has been disabled.', 403);

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) throw new AppError('Invalid credentials.', 401);

      await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

      const token = issueToken(user);
      delete user.password_hash;
      const permissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
      res.json({ token, user: { ...user, permissions } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticate,
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 8 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError('New password must be at least 8 characters.', 422);

      const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
      const valid = await bcrypt.compare(req.body.currentPassword, rows[0].password_hash);
      if (!valid) throw new AppError('Current password is incorrect.', 401);

      const hash = await bcrypt.hash(req.body.newPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10));
      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
      res.json({ message: 'Password updated successfully.' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/staff  (admin creates staff accounts)
router.post(
  '/staff',
  authenticate,
  authorize('all', 'write'),
  [
    body('fullName').notEmpty(),
    body('email').isEmail(),
    body('username').notEmpty(),
    body('password').isLength({ min: 8 }),
    body('roleId').isInt()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError('Please provide valid staff details.', 422);

      const { fullName, email, username, password, roleId, phone } = req.body;
      const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10));
      const [result] = await pool.query(
        `INSERT INTO users (role_id, full_name, email, username, password_hash, phone) VALUES (?,?,?,?,?,?)`,
        [roleId, fullName, email, username, hash, phone || null]
      );
      res.status(201).json({ id: result.insertId, message: 'Staff account created.' });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/roles
router.get('/roles', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, name, description FROM roles ORDER BY id');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/staff — list all staff accounts (admin only)
router.get('/staff', authenticate, authorize('all', 'write'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.username, u.status, u.last_login_at, r.id AS role_id, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.full_name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/staff/:id — change role or active/disabled status
router.patch('/staff/:id', authenticate, authorize('all', 'write'), async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { roleId, status } = req.body;

    if (targetId === req.user.id && status === 'disabled') {
      throw new AppError('You cannot disable your own account.', 400);
    }

    const updates = [];
    const values = [];
    if (roleId !== undefined) { updates.push('role_id = ?'); values.push(roleId); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (!updates.length) throw new AppError('No valid fields to update.', 422);

    values.push(targetId);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Staff account updated.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/staff/:id — permanently remove a staff account
router.delete('/staff/:id', authenticate, authorize('all', 'write'), async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (targetId === req.user.id) throw new AppError('You cannot delete your own account.', 400);

    const [[target]] = await pool.query('SELECT role_id FROM users WHERE id = ?', [targetId]);
    if (!target) throw new AppError('Staff account not found.', 404);

    const [[adminRole]] = await pool.query('SELECT id FROM roles WHERE name = "admin" LIMIT 1');
    if (adminRole && target.role_id === adminRole.id) {
      const [[adminCount]] = await pool.query(
        'SELECT COUNT(*) AS count FROM users WHERE role_id = ? AND status = "active"',
        [adminRole.id]
      );
      if (adminCount.count <= 1) throw new AppError('Cannot delete the last remaining administrator.', 409);
    }

    await pool.query('DELETE FROM users WHERE id = ?', [targetId]);
    res.json({ message: 'Staff account deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
