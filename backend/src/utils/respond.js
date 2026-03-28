function sendError(res, status, error, detail) {
  const payload = { error };
  if (detail) {
    payload.detail = detail;
  }
  return res.status(status).json(payload);
}

module.exports = {
  sendError
};
