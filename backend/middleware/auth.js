const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

/**
 * Verifies the JWT bearer token and attaches `req.user`.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.username, u.status, r.name AS role, r.permissions
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1`,
      [payload.sub]
    );
    if (!rows.length || rows[0].status !== 'active') {
      return res.status(401).json({ error: 'Account not found or disabled.' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Restricts a route to specific module + action, e.g. authorize('reservations','write').
 * The 'admin' role (permissions.all) always passes.
 */
function authorize(module, action = 'read') {
  return (req, res, next) => {
    const perms = req.user?.permissions;
    if (!perms) return res.status(403).json({ error: 'Forbidden.' });
    const parsed = typeof perms === 'string' ? JSON.parse(perms) : perms;
    const allowedAll = parsed.all && parsed.all.includes(action);
    const allowedModule = parsed[module] && parsed[module].includes(action);
    if (allowedAll || allowedModule) return next();
    return res.status(403).json({ error: `You do not have ${action} access to ${module}.` });
  };
}

module.exports = { authenticate, authorize };
