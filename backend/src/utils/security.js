const { randomBytes, scryptSync, timingSafeEqual } = require('crypto');

function makeToken(prefix) {
  return `${prefix}_${randomBytes(18).toString('hex')}`;
}

function makeBindCode() {
  return randomBytes(4).toString('hex').toUpperCase();
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const derived = scryptSync(password, salt, 64);
  const actual = Buffer.from(hash, 'hex');

  if (derived.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(derived, actual);
}

function maskToken(token) {
  return `${token.slice(0, 7)}...${token.slice(-5)}`;
}

module.exports = {
  hashPassword,
  makeBindCode,
  makeToken,
  maskToken,
  verifyPassword
};
