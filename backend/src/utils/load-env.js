const fs = require('fs');
const path = require('path');

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  if (!key) {
    return null;
  }

  return { key, value };
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

function loadEnv() {
  const backendRoot = path.join(__dirname, '..', '..');
  const nodeEnv = process.env.NODE_ENV || 'development';
  const candidateFiles = [
    path.join(backendRoot, '.env'),
    path.join(backendRoot, `.env.${nodeEnv}`),
    path.join(backendRoot, '.env.local')
  ];

  for (const filePath of candidateFiles) {
    loadEnvFile(filePath);
  }
}

module.exports = {
  loadEnv
};
