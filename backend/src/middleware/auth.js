const { agentService, authRepository } = require('../container');
const { sendError } = require('../utils/respond');

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function requireUser(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return sendError(res, 401, '缺少用户登录凭证。');
  }

  const user = authRepository.getUserBySessionToken(token);
  if (!user) {
    return sendError(res, 401, '用户凭证无效。');
  }

  req.user = user;
  return next();
}

function requireAdmin(req, res, next) {
  return requireUser(req, res, () => {
    if (req.user.role !== 'admin') {
      return sendError(res, 403, '需要管理员权限。');
    }
    return next();
  });
}

function requireAgent(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return sendError(res, 401, '缺少 Agent 凭证。');
  }

  const agent = agentService.getAgentByToken(token);
  if (!agent) {
    return sendError(res, 401, 'Agent 凭证无效。');
  }
  if (agent.status !== 'active') {
    return sendError(res, 403, 'Agent 已被暂停。');
  }

  req.agent = agent;
  return next();
}

function ensureOwnerAgent(req, res, next) {
  const agentId = Number(req.params.agentId);
  const agent = agentService.getAgentWithRules(agentId);

  if (!agent) {
    return sendError(res, 404, 'Agent 不存在。');
  }

  const agents = agentService.getAgentsForUser(req.user.id);
  if (!agents.find((item) => item.id === agentId)) {
    return sendError(res, 403, '无权访问该 Agent。');
  }

  req.ownerAgent = agent;
  return next();
}

module.exports = {
  ensureOwnerAgent,
  requireAdmin,
  requireAgent,
  requireUser
};
