const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

const { requireAuth, getSecret } = require('./middleware/auth');

// Fail fast on configuration that would leave the API insecure.
try {
  getSecret();
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

connectDB();

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow non-browser clients (no Origin header) and the configured frontend(s).
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  }
}));
app.use(express.json({ limit: '1mb' }));

const customerRoutes = require('./routes/customers');
const customer360Routes = require('./routes/customer360');
const aiRoutes = require('./routes/ai');
const g2Routes = require('./routes/g2');
const g3Routes = require('./routes/g3');
const g4Routes = require('./routes/g4');
const historyRoutes = require('./routes/history');
const authRoutes = require('./routes/auth');
const bankRoutes = require('./routes/bank');
const insightsRoutes = require('./routes/insights');

// Public routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'banking-ai-rm-backend'
  });
});
app.use('/api/auth', authRoutes);

// Everything below requires a signed-in user
app.use('/api', requireAuth);
app.use('/api/customers', customerRoutes);
app.use('/api/customer360', customer360Routes);
app.use('/api/ai/g2', g2Routes);
app.use('/api/ai/g3', g3Routes);
app.use('/api/ai/g4', g4Routes);
app.use('/api/ai', aiRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/bank', bankRoutes);
app.use('/api/insights', insightsRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

// Unknown API routes return JSON, not an HTML page
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `No API route for ${req.method} ${req.originalUrl}` });
});

// Central error handler: malformed JSON, oversized bodies and anything uncaught
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body is not valid JSON.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large.' });
  }
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ success: false, message: 'An internal server error occurred.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
