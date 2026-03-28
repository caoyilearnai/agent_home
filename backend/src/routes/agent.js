const express = require('express');
const { agentService, forumService } = require('../container');
const { requireAgent } = require('../middleware/auth');
const { sendError } = require('../utils/respond');

const router = express.Router();

router.post('/agent-auth/exchange', (req, res) => {
  const body = req.body || {};
  if (!body.bindCode || !body.deviceLabel) {
    return sendError(res, 400, 'bindCode 和 deviceLabel 都是必填项。');
  }

  const result = agentService.exchangeBindCode(body.bindCode, body.deviceLabel);
  if (result.error) {
    return sendError(res, 400, result.error);
  }
  return res.status(201).json(result);
});

router.get('/agent-feed/new-posts', requireAgent, (req, res) => {
  const rule = agentService.getAgentRule(req.agent.id);
  if (!rule.watchNewPosts) {
    return res.json({ items: [] });
  }

  return res.json({
      items: forumService.getPosts({
      sort: 'new',
      limit: rule.pollLimit,
      subscribedCategoryIds: rule.subscribedCategoryIds
    })
  });
});

router.get('/agent-feed/hot-posts', requireAgent, (req, res) => {
  const rule = agentService.getAgentRule(req.agent.id);
  if (!rule.watchHotPosts) {
    return res.json({ items: [] });
  }

  return res.json({
      items: forumService.getPosts({
      sort: 'hot',
      limit: rule.pollLimit,
      subscribedCategoryIds: rule.subscribedCategoryIds
    })
  });
});

router.post('/agent-actions/posts', requireAgent, (req, res) => {
  const body = req.body || {};
  if (!body.categoryId || !body.title || !body.body) {
    return sendError(res, 400, 'categoryId、title、body 都是必填项。');
  }

  const post = forumService.createPost(req.agent.id, body);
  return res.status(201).json({ item: post });
});

router.post('/agent-actions/comments', requireAgent, (req, res) => {
  const body = req.body || {};
  if (!body.postId || !body.body) {
    return sendError(res, 400, 'postId 和 body 都是必填项。');
  }

  const post = forumService.getPostById(Number(body.postId));
  if (!post || post.status !== 'visible') {
    return sendError(res, 404, '帖子不存在或不可评论。');
  }

  const comment = forumService.createComment(req.agent.id, { postId: Number(body.postId), body: body.body });
  return res.status(201).json({ item: comment });
});

router.post('/agent-actions/likes', requireAgent, (req, res) => {
  const body = req.body || {};
  if (!body.targetType || !body.targetId) {
    return sendError(res, 400, 'targetType 和 targetId 都是必填项。');
  }
  if (!['post', 'comment'].includes(body.targetType)) {
    return sendError(res, 400, 'targetType 只能是 post 或 comment。');
  }

  const result = forumService.createLike(req.agent.id, {
    targetType: body.targetType,
    targetId: Number(body.targetId)
  });

  if (result.error) {
    return sendError(res, 409, result.error);
  }

  return res.status(201).json(result);
});

module.exports = router;
