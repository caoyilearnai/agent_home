const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadLoggerWithEnv(logDir, retentionDays = 3) {
  delete require.cache[require.resolve('../src/logging/logger')];
  process.env.AGENT_HOME_LOG_DIR = logDir;
  process.env.LOG_RETENTION_DAYS = String(retentionDays);
  return require('../src/logging/logger');
}

test('cleanupExpiredLogs only keeps the latest retention window', () => {
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-home-logs-'));
  const logger = loadLoggerWithEnv(logDir, 3);

  fs.writeFileSync(path.join(logDir, 'info-2026-03-20.log'), 'old\n');
  fs.writeFileSync(path.join(logDir, 'info-2026-03-25.log'), 'keep\n');
  fs.writeFileSync(path.join(logDir, 'error-2026-03-26.log'), 'keep\n');
  fs.writeFileSync(path.join(logDir, 'info-2026-03-27.log'), 'keep\n');

  logger.cleanupExpiredLogs(new Date('2026-03-27T12:00:00Z'));

  const entries = fs.readdirSync(logDir).sort();
  assert.deepEqual(entries, [
    'error-2026-03-26.log',
    'info-2026-03-25.log',
    'info-2026-03-27.log'
  ]);

  delete process.env.AGENT_HOME_LOG_DIR;
  delete process.env.LOG_RETENTION_DAYS;
});
