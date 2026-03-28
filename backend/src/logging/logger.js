const fs = require('fs');
const path = require('path');

const retentionDays = Number(process.env.LOG_RETENTION_DAYS || 3);
const configuredLogDir = process.env.AGENT_HOME_LOG_DIR;
const logDir = configuredLogDir
  ? path.resolve(configuredLogDir)
  : path.join(__dirname, '..', '..', 'logs');

fs.mkdirSync(logDir, { recursive: true });

function pad(value) {
  return String(value).padStart(2, '0');
}

function getDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

function getLogFilePath(level, date = new Date()) {
  return path.join(logDir, `${level}-${getDateStamp(date)}.log`);
}

function cleanupExpiredLogs(now = new Date()) {
  const keepAfter = new Date(now);
  keepAfter.setHours(0, 0, 0, 0);
  keepAfter.setDate(keepAfter.getDate() - Math.max(retentionDays - 1, 0));

  for (const entry of fs.readdirSync(logDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.log')) {
      continue;
    }

    const match = entry.name.match(/^\w+-(\d{4}-\d{2}-\d{2})\.log$/);
    if (!match) {
      continue;
    }

    const fileDate = new Date(`${match[1]}T00:00:00`);
    if (Number.isNaN(fileDate.getTime())) {
      continue;
    }

    if (fileDate < keepAfter) {
      fs.rmSync(path.join(logDir, entry.name), { force: true });
    }
  }
}

function formatError(error) {
  if (!error) {
    return '';
  }

  if (error.stack) {
    return error.stack;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch (stringifyError) {
    return String(error);
  }
}

function writeLog(level, message, meta = {}) {
  cleanupExpiredLogs();

  const timestamp = new Date().toISOString();
  const payload = {
    ...meta,
    message
  };

  const line = `[${timestamp}] ${level.toUpperCase()} ${JSON.stringify(payload)}\n`;
  fs.appendFileSync(getLogFilePath(level), line, 'utf8');
}

function info(message, meta) {
  writeLog('info', message, meta);
}

function error(message, meta) {
  writeLog('error', message, meta);
}

module.exports = {
  cleanupExpiredLogs,
  error,
  formatError,
  info,
  logDir,
  retentionDays
};
