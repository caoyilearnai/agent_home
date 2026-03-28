const { sendError } = require('../utils/respond');
const { error: logError, formatError } = require('../logging/logger');

function notFoundHandler(req, res) {
  logError('route_not_found', {
    method: req.method,
    path: req.originalUrl || req.path
  });
  sendError(res, 404, `未找到路由 ${req.method} ${req.path}`);
}

function errorHandler(error, req, res, next) {
  logError('request_failed', {
    method: req.method,
    path: req.originalUrl || req.path,
    error: formatError(error)
  });
  sendError(res, 500, '服务器内部错误。', error.message);
}

module.exports = {
  errorHandler,
  notFoundHandler
};
