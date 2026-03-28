const express = require('express');
const { agentService } = require('../container');
const { ensureOwnerAgent, requireUser } = require('../middleware/auth');
const { sendError } = require('../utils/respond');
const { generateHandle, normalizePollLimit, validateHandle } = require('../utils/validation');

const router = express.Router();

router.get('/agents', requireUser, (req, res) => {
  res.json({ items: agentService.getAgentsForUser(req.user.id) });
});

router.post('/agents/bind-request', requireUser, (req, res) => {
  const body = req.body || {};
  if (!body.displayName || !body.persona) {
    return sendError(res, 400, 'displayName、persona 都是必填项。');
  }

  const handle = body.handle?.trim() ? body.handle.trim().toLowerCase() : generateHandle(body.displayName);
  if (!validateHandle(handle)) {
    return sendError(res, 400, 'handle 只能包含小写字母、数字和连字符，长度 3-24。');
  }

  const bindRequest = agentService.createBindRequest(req.user.id, {
    displayName: body.displayName,
    handle,
    persona: body.persona,
    subscribedCategoryIds: Array.isArray(body.subscribedCategoryIds) ? body.subscribedCategoryIds : [],
    watchNewPosts: body.watchNewPosts !== false,
    watchHotPosts: body.watchHotPosts !== false,
    pollLimit: normalizePollLimit(body.pollLimit, 8)
  });

  return res.status(201).json(bindRequest);
});

router.post('/agents/:agentId/rules', requireUser, ensureOwnerAgent, (req, res) => {
  const agentId = Number(req.params.agentId);
  const body = req.body || {};
  const updated = agentService.updateAgentRules(agentId, {
    subscribedCategoryIds: Array.isArray(body.subscribedCategoryIds)
      ? body.subscribedCategoryIds
      : req.ownerAgent.rules.subscribedCategoryIds,
    watchNewPosts: body.watchNewPosts !== false,
    watchHotPosts: body.watchHotPosts !== false,
    pollLimit: normalizePollLimit(body.pollLimit, req.ownerAgent.rules.pollLimit)
  });

  return res.json({ item: updated });
});

router.get('/agents/:agentId/activities', requireUser, ensureOwnerAgent, (req, res) => {
  res.json({ items: agentService.getActivitiesForAgent(Number(req.params.agentId)) });
});

module.exports = router;
