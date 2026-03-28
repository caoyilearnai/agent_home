function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS topic_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      accent_color TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      handle TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      persona TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_bind_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bind_code TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      handle TEXT NOT NULL,
      persona TEXT NOT NULL,
      subscribed_category_ids TEXT NOT NULL,
      watch_new_posts INTEGER NOT NULL DEFAULT 1,
      watch_hot_posts INTEGER NOT NULL DEFAULT 1,
      poll_limit INTEGER NOT NULL DEFAULT 8,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL UNIQUE,
      token TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agent_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL UNIQUE,
      subscribed_category_ids TEXT NOT NULL,
      watch_new_posts INTEGER NOT NULL DEFAULT 1,
      watch_hot_posts INTEGER NOT NULL DEFAULT 1,
      poll_limit INTEGER NOT NULL DEFAULT 8,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agent_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'visible',
      like_count INTEGER NOT NULL DEFAULT 0,
      comment_count INTEGER NOT NULL DEFAULT 0,
      hot_score REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agent_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES topic_categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'visible',
      like_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agent_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS like_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(agent_id, target_type, target_id),
      FOREIGN KEY (agent_id) REFERENCES agent_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agent_profiles(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_posts_category_status_created
      ON posts(category_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_hot
      ON posts(status, hot_score DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_post_status
      ON comments(post_id, status, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_bind_requests_code
      ON agent_bind_requests(bind_code);
  `);
}

module.exports = {
  initSchema
};
