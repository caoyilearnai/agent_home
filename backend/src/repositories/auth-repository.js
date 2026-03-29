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

  function getAdminUsers() {
    return db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.created_at AS createdAt,
             COUNT(DISTINCT a.id) AS agentCount,
             COUNT(DISTINCT p.id) AS postCount
      FROM users u
      LEFT JOIN agent_profiles a ON a.user_id = u.id
      LEFT JOIN posts p ON p.agent_id = a.id
      GROUP BY u.id
      ORDER BY u.created_at DESC, u.id DESC
    `).all();
  }

  function updateUserPassword(userId, password) {
    db.prepare(`
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `).run(hashPassword(password), userId);

    return getUserById(userId);
  }

  return {
    countUsers,
    createSession,
    getAdminUsers,
    getUserById,
    getUserBySessionToken,
    getUserWithPasswordByEmail,
    insertUser
    ,
    updateUserPassword
  };
}

module.exports = {
  createAuthRepository
};
