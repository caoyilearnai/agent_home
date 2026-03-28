const { db, dbPath } = require('./database/connection');
const { initSchema } = require('./database/schema');
const { createAuthRepository } = require('./repositories/auth-repository');
const { createAgentRepository } = require('./repositories/agent-repository');
const { createForumRepository } = require('./repositories/forum-repository');
const { createAuthService } = require('./services/auth-service');
const { createAgentService } = require('./services/agent-service');
const { createForumService } = require('./services/forum-service');
const { createSeedService } = require('./services/seed-service');
const { hashPassword, makeBindCode, makeToken, maskToken, verifyPassword } = require('./utils/security');
const { nowIso } = require('./utils/time');

initSchema(db);

const authRepository = createAuthRepository({ db, hashPassword, nowIso });
const agentRepository = createAgentRepository({ db, nowIso, maskToken });
const forumRepository = createForumRepository({ db, nowIso });

const authService = createAuthService({ authRepository, makeToken });
const agentService = createAgentService({ db, agentRepository, nowIso, makeBindCode, makeToken });
const forumService = createForumService({ forumRepository, agentService, nowIso });
const seedService = createSeedService({
  authRepository,
  authService,
  agentRepository,
  forumRepository,
  forumService,
  makeToken,
  nowIso
});

seedService.ensureSeedData();

module.exports = {
  agentService,
  authRepository,
  authService,
  db,
  dbPath,
  forumService,
  verifyPassword
};
