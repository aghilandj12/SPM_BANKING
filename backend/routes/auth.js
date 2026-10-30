const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const User = require('../models/User');
const { signToken, requireAuth } = require('../middleware/auth');

const BCRYPT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const isHashed = (value) => typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);

// Seed the default user if it doesn't exist (password stored hashed)
const seedUser = async () => {
  try {
    const existingUser = await User.findOne({ userId: 'aghilan' });
    if (!existingUser) {
      await User.create({
        name: 'aghilan',
        userId: 'aghilan',
        password: await bcrypt.hash('12345678', BCRYPT_ROUNDS)
      });
      console.log('Default user seeded: aghilan');
    }
  } catch (err) {
    console.error('Error seeding user:', err);
  }
};

seedUser();

// Failed-login tracking per client + user id, to slow down password guessing.
const failedLogins = new Map();

function lockKey(req, userId) {
  return `${req.ip}|${userId.toLowerCase()}`;
}

function isLocked(key) {
  const entry = failedLogins.get(key);
  if (!entry) return 0;
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) return entry.lockedUntil - Date.now();
  if (entry.lockedUntil) failedLogins.delete(key);
  return 0;
}

function recordFailure(key) {
  const entry = failedLogins.get(key) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_FAILED_ATTEMPTS) entry.lockedUntil = Date.now() + LOCKOUT_MS;
  failedLogins.set(key, entry);
  return MAX_FAILED_ATTEMPTS - entry.count;
}

router.post('/login', async (req, res) => {
  const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!userId || !password) {
    return res.status(400).json({ success: false, message: 'User ID and password are required.' });
  }
  if (userId.length > 64 || password.length > 128) {
    return res.status(400).json({ success: false, message: 'Invalid user ID or password' });
  }

  const key = lockKey(req, userId);
  const lockedForMs = isLocked(key);
  if (lockedForMs > 0) {
    return res.status(429).json({
      success: false,
      message: `Too many failed attempts. Try again in ${Math.ceil(lockedForMs / 60000)} minute(s).`
    });
  }

  try {
    const user = await User.findOne({ userId });

    let valid = false;
    if (user) {
      if (isHashed(user.password)) {
        valid = await bcrypt.compare(password, user.password);
      } else {
        // Legacy plain-text password: accept once, then upgrade it to a hash.
        valid = user.password === password;
        if (valid) {
          user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
          await user.save();
          console.log(`[Auth] Upgraded stored password to bcrypt hash for ${userId}`);
        }
      }
    }

    if (!valid) {
      const remaining = recordFailure(key);
      const message = remaining > 0
        ? 'Invalid user ID or password'
        : `Too many failed attempts. Try again in ${LOCKOUT_MS / 60000} minutes.`;
      return res.status(remaining > 0 ? 401 : 429).json({ success: false, message });
    }

    failedLogins.delete(key);
    res.json({
      success: true,
      token: signToken(user),
      user: {
        name: user.name,
        userId: user.userId
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// GET /api/auth/me - lets the frontend restore a session after a page refresh
router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
