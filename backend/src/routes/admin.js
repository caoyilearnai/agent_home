const { authRepository } = require('../container');
const express = require('express');
const { agentService, forumService } = require('../container');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/users', requireAdmin, (req, res) => {
  res.json({ items: authRepository.getAdminUsers() });
});

router.get('/agents', requireAdmin, (req, res) => {
  res.json({ items: agentService.getAllAgents() });
});

router.get('/agents/:agentId', requireAdmin, (req, res) => {
  const agentId = Number(req.params.agentId);
  const agent = agentService.getAgentWithRules(agentId);

  if (!agent) {
    return res.status(404).json({ error: 'Agent 不存在。' });
  }

  const owner = authRepository.getUserById(agent.ownerId || agent.user_id);
  const posts = forumService.getPostsByAgentId(agentId, 20, 0);
  const postsCount = forumService.countPostsByAgentId(agentId);
  const comments = forumService.getCommentsByAgentId(agentId, 20, 0);
  const commentsCount = forumService.countCommentsByAgentId(agentId);
  const likes = forumService.getLikesByAgentId(agentId, 20, 0);
  const likesCount = forumService.countLikesByAgentId(agentId);

  return res.json({
    agent: {
      ...agent,
      owner
    },
    stats: {
      postsCount,
      commentsCount,
      likesCount
    },
    posts,
    comments,
    likes
  });
});

router.get('/posts', requireAdmin, (req, res) => {
  const status = req.query.status || null;
  const limit = Math.min(Number(req.query.limit || 10), 50);
  const requestedPage = Math.max(Number(req.query.page || 1), 1);

  const userIds = req.query.userIds
    ? String(req.query.userIds).split(',').map(Number).filter(Boolean)
    : [];
  const agentIds = req.query.agentIds
    ? String(req.query.agentIds).split(',').map(Number).filter(Boolean)
    : [];

  const total = forumService.countPosts({
    onlyVisible: false,
    status,
    userIds,
    agentIds
  });
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * limit;

  res.json({
    items: forumService.getPosts({
      sort: 'new',
      limit,
      offset,
      onlyVisible: false,
      status,
      userIds,
      agentIds
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  });
});

router.post('/posts/:postId/hide', requireAdmin, (req, res) => {
  forumService.hidePost(Number(req.params.postId));
  res.json({ ok: true });
});

router.post('/comments/:commentId/hide', requireAdmin, (req, res) => {
  forumService.hideComment(Number(req.params.commentId));
  res.json({ ok: true });
});

router.post('/agents/:agentId/suspend', requireAdmin, (req, res) => {
  agentService.suspendAgent(Number(req.params.agentId));
  res.json({ ok: true });
});

router.post('/agents/:agentId/activate', requireAdmin, (req, res) => {
  agentService.activateAgent(Number(req.params.agentId));
  res.json({ ok: true });
});

router.post('/posts/:postId/delete', requireAdmin, (req, res) => {
  forumService.deletePost(Number(req.params.postId));
  res.json({ ok: true });
});

module.exports = router;
