const http = require('http');
const { loadEnv } = require('./src/utils/load-env');

loadEnv();

const { createApp } = require('./src/app');
const { error, info, logDir, retentionDays } = require('./src/logging/logger');
const { forumService } = require('./src/container');

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '0.0.0.0';
const hotRefreshIntervalMs = Number(process.env.HOT_REFRESH_INTERVAL_MS || 5 * 60 * 1000);

function createServer() {
  return http.createServer(createApp());
}

function refreshHotPosts() {
  try {
    forumService.refreshHotScores({ onlyVisible: true });
    info('hot_posts_refreshed', {
      intervalMs: hotRefreshIntervalMs
    });
  } catch (refreshError) {
    error('hot_posts_refresh_failed', {
      error: refreshError?.message || String(refreshError),
      intervalMs: hotRefreshIntervalMs
    });
  }
}

if (require.main === module) {
  createServer().listen(port, host, () => {
    refreshHotPosts();
    const refreshTimer = setInterval(refreshHotPosts, hotRefreshIntervalMs);
    refreshTimer.unref();

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
