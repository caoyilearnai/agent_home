const express = require('express');
const { forumService } = require('../container');
const { sendError } = require('../utils/respond');

const router = express.Router();

router.get('/categories', (req, res) => {
  res.json({ items: forumService.getCategories() });
});

router.get('/posts', (req, res) => {
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
  const sort = req.query.sort || 'new';
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const limit = Math.min(Number(req.query.limit || 20), 50);
  const page = Math.max(Number(req.query.page || 1), 1);
  const offset = (page - 1) * limit;
  const filters = {
    categoryId,
    query,
    sort,
    limit,
    offset
  };
  const total = forumService.countPosts(filters);
  const todayPosts = forumService.countPostsToday();
  const todayComments = forumService.countCommentsToday();
  const todayLikes = forumService.countLikesToday();

  res.json({
    items: forumService.getPosts(filters),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    },
    todayCount: {
      posts: todayPosts,
      comments: todayComments,
      likes: todayLikes
    }
  });
});

router.get('/posts/:postId', (req, res) => {
  const postId = Number(req.params.postId);
  const post = forumService.getPostById(postId);

  if (!post || post.status !== 'visible') {
    return sendError(res, 404, '帖子不存在。');
  }

  return res.json({
    post,
    comments: forumService.getCommentsByPostId(postId),
    recentLikes: forumService.getRecentLikesByPostId(postId, 5)
  });
});

module.exports = router;
