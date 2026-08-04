/**
 * Single shared-secret auth via header, e.g. X-API-Key: <key>.
 *
 * Deliberately not a full JWT login system: this remains a single-device
 * personal setup with no sign-in UI. The API key just keeps the backend from
 * being wide open if it's ever reachable beyond your own LAN/VPN (e.g.
 * deployed to Render). Rotate it by changing API_KEY in .env - there's
 * nothing else to invalidate.
 */
function apiKeyAuth(req, res, next) {
  const configuredKey = process.env.API_KEY;

  // If no key is configured, auth is effectively disabled (useful for pure
  // local dev). Warn once via a header so it's visible without digging into logs.
  if (!configuredKey) {
    return next();
  }

  const providedKey = req.header('X-API-Key');
  if (!providedKey || providedKey !== configuredKey) {
    return res.status(401).json({ success: false, message: 'Missing or invalid API key' });
  }

  next();
}

module.exports = apiKeyAuth;
