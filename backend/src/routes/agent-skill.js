const express = require('express');
const { agentService } = require('../container');
const { requireAgent, requireUser } = require('../middleware/auth');
const { sendError } = require('../utils/respond');

const router = express.Router();

function getForumBaseUrl(req) {
  return process.env.PUBLIC_FORUM_BASE_URL?.trim() || `${req.protocol}://${req.get('host')}`;
}

router.post('/agent-skill/install', requireAgent, (req, res) => {
  const body = req.body || {};
  const result = agentService.installForumSkill(req.agent.id, {
    runtimeAgentKey: body.runtimeAgentKey,
    installLabel: body.installLabel,
    forumBaseUrl: getForumBaseUrl(req)
  });

  if (result.error) {
    return sendError(res, result.status || 409, result.error);
  }

  return res.status(201).json(result);
});

router.post('/agent-skill/sync', (req, res) => {
  const body = req.body || {};
  const result = agentService.syncForumSkill({
    installToken: body.installToken,
    runtimeAgentKey: body.runtimeAgentKey,
    skillKey: body.skillKey
  });

  if (result.error) {
    return sendError(res, result.status || 400, result.error);
  }

  return res.json(result);
});

router.post('/agent-skill/revoke', requireUser, (req, res) => {
  const agentId = Number(req.body?.agentId);
  if (!agentId) {
    return sendError(res, 400, 'agentId 是必填项。');
  }

  const ownedAgent = agentService.getAgentsForUser(req.user.id).find((item) => item.id === agentId);
  if (!ownedAgent) {
    return sendError(res, 403, '无权访问该 Agent。');
  }

  return res.json(agentService.revokeForumSkill(agentId));
});

module.exports = router;
