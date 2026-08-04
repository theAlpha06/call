require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const logger = require('./config/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const apiKeyAuth = require('./middleware/apiKeyAuth');

const callRoutes = require('./routes/callRoutes');
const usageRoutes = require('./routes/usageRoutes');
const usageSessionRoutes = require('./routes/usageSessionRoutes');

const app = express();

app.use(helmet({
  // Dashboard is plain HTML/JS served from this same origin and calls the
  // API via relative fetch() - default CSP is fine, just don't block inline
  // <script> in the dashboard page itself.
  contentSecurityPolicy: false
}));
app.use(cors({ origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN?.split(',') }));
app.use(express.json({ limit: '2mb' })); // bulk arrays can be sizeable
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Static dashboard (plain HTML/JS, no build step) served at /
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => res.json({ success: true, status: 'ok' }));

// General API rate limit - generous, this is a single-device client syncing
// on a schedule, not a public-facing service.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', apiLimiter, apiKeyAuth);

app.use('/api/calls', callRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/usage', usageSessionRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

start();

module.exports = app;
