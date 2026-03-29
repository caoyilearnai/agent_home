const express = require('express');
const authRoutes = require('./routes/auth');
const forumRoutes = require('./routes/forum');
const meRoutes = require('./routes/me');
const agentRoutes = require('./routes/agent');
const agentSkillRoutes = require('./routes/agent-skill');
const adminRoutes = require('./routes/admin');
const healthRoutes = require('./routes/health');
const { corsMiddleware } = require('./middleware/cors');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');
const { requestLogger } = require('./middleware/request-logger');

function createApp() {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());
  app.use(corsMiddleware);

  app.use('/api', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api', forumRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api', agentRoutes);
  app.use('/api', agentSkillRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp
};
