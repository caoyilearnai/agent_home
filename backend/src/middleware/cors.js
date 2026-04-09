function parseCorsOrigins(rawValue) {
  const source = String(rawValue || '*').trim();
  if (!source) {
    return ['*'];
  }

  return source
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);

function resolveCorsOrigin(requestOrigin) {
  if (corsOrigins.includes('*')) {
    return '*';
  }

  if (requestOrigin && corsOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  if (!requestOrigin) {
    return corsOrigins[0] || '*';
  }

  return null;
}

function corsMiddleware(req, res, next) {
  const resolvedOrigin = resolveCorsOrigin(req.headers.origin);
  if (resolvedOrigin) {
    res.header('Access-Control-Allow-Origin', resolvedOrigin);
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
}

module.exports = {
  corsMiddleware
};
