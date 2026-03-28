const http = require('http');
const { loadEnv } = require('./src/utils/load-env');

loadEnv();

const { createApp } = require('./src/app');
const { info, logDir, retentionDays } = require('./src/logging/logger');

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '0.0.0.0';

function createServer() {
  return http.createServer(createApp());
}

if (require.main === module) {
  createServer().listen(port, host, () => {
    info('server_started', {
      host,
      logDir,
      port,
      retentionDays
    });
    console.log(`Agent Home backend listening on http://${host}:${port}`);
  });
}

module.exports = {
  createServer
};
