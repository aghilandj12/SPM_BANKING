const jwt = require('jsonwebtoken');

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set in backend/.env (at least 32 characters).');
  }
  return secret;
}

function signToken(user) {
  return jwt.sign(
    { sub: user.userId, name: user.name },
    getSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

// Rejects any request without a valid "Authorization: Bearer <token>" header.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  try {
    const payload = jwt.verify(token, getSecret());
    req.user = { userId: payload.sub, name: payload.name };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Session expired. Please sign in again.' : 'Invalid session. Please sign in again.';
    return res.status(401).json({ success: false, message });
  }
}

module.exports = { signToken, requireAuth, getSecret };
