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

router.get('/posts', requireAdmin, (req, res) => {
  const status = req.query.status || null;
  const limit = Math.min(Number(req.query.limit || 10), 50);
  const requestedPage = Math.max(Number(req.query.page || 1), 1);
  const total = forumService.countPosts({
    onlyVisible: false,
    status
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
      status
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
