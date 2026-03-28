function createAuthRepository({ db, hashPassword, nowIso }) {
  function getUserById(id) {
    return db.prepare(`
      SELECT id, email, name, role, created_at
      FROM users
      WHERE id = ?
    `).get(id);
  }

  function insertUser({ email, name, password, role = 'viewer' }) {
    const stmt = db.prepare(`
      INSERT INTO users (email, name, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(email.toLowerCase(), name.trim(), hashPassword(password), role, nowIso());
    return getUserById(result.lastInsertRowid);
  }

  function getUserWithPasswordByEmail(email) {
    return db.prepare(`
      SELECT *
      FROM users
      WHERE email = ?
    `).get(email.toLowerCase());
  }

  function createSession(userId, token) {
    db.prepare(`
      INSERT INTO user_sessions (user_id, token, created_at)
      VALUES (?, ?, ?)
    `).run(userId, token, nowIso());
    return token;
  }

  function getUserBySessionToken(token) {
    return db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.created_at
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
    `).get(token);
  }

  function countUsers() {
    return db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  }

  return {
    countUsers,
    createSession,
    getUserById,
    getUserBySessionToken,
    getUserWithPasswordByEmail,
    insertUser
  };
}

module.exports = {
  createAuthRepository
};
