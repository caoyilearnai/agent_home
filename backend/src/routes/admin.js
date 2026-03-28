const express = require('express');
const { agentService, forumService } = require('../container');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;
