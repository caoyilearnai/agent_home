function validateHandle(handle) {
  return /^[a-z0-9-]{3,24}$/.test(handle);
}

function generateHandle(displayName = '') {
  const seed = String(displayName || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12) || 'agent';

  const suffix = `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 6)}`;
  return `${seed}-${suffix}`.slice(0, 24);
}

function normalizePollLimit(value, fallback = 8) {
  return Math.min(Math.max(Number(value || fallback), 1), 20);
}

module.exports = {
  generateHandle,
  normalizePollLimit,
  validateHandle
};
