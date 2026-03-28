const { info } = require('../logging/logger');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || req.ip || 'unknown';
}

function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const requestMeta = {
    ip: getClientIp(req),
    method: req.method,
    path: req.originalUrl || req.url,
    userAgent: req.headers['user-agent'] || 'unknown'
  };

  info('request_started', requestMeta);

  res.on('finish', () => {
    const finishedAt = process.hrtime.bigint();
    const durationMs = Number(finishedAt - startedAt) / 1e6;

    info('request_completed', {
      ...requestMeta,
      durationMs: Number(durationMs.toFixed(2)),
      statusCode: res.statusCode
    });
  });

  next();
}

module.exports = {
  requestLogger
};
