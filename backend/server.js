require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

/* ------------------------------- Security -------------------------------- */
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.info(msg.trim()) }
}));

const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MIN || '15', 10)) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

/* -------------------------------- Routes ---------------------------------- */
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '5.0.0', time: new Date().toISOString() }));

app.use('/api/setup', require('./routes/setup'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/front-desk', require('./routes/frontdesk'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/housekeeping', require('./routes/housekeeping'));
app.use('/api/pos', require('./routes/pos'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/guests', require('./routes/guests'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/payments', require('./routes/payments'));

app.use(notFound);
app.use(errorHandler);

const { scheduleLowStockDigest } = require('./jobs/lowStockDigest');
scheduleLowStockDigest();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`HotelPro 5.0 API listening on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
