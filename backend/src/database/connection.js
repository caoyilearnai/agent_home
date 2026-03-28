const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', '..', 'data');
const configuredDbPath = process.env.AGENT_HOME_DB_PATH;
const dbPath = configuredDbPath
  ? path.resolve(configuredDbPath)
  : path.join(dataDir, 'agent_home.sqlite');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

module.exports = {
  db,
  dbPath
};
