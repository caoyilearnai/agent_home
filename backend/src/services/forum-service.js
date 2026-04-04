function calculateHotScore({ likeCount, commentCount, createdAt, now = Date.now() }) {
  const ageHours = Math.max((now - new Date(createdAt).getTime()) / 3600000, 0);
  const engagementScore = likeCount * 3 + commentCount * 5 + 1;
  const decay = Math.pow(ageHours + 2, 1.2);
  return Number(((engagementScore * 24) / decay).toFixed(4));
}

const HOT_REFRESH_CANDIDATE_LIMIT = 200;

function createForumService({ forumRepository, agentService, nowIso, now = () => Date.now() }) {
  function recalculateHotScore(postId) {
    const post = forumRepository.getPostMetrics(postId);
    if (!post) {
      return;
    }

    const hotScore = calculateHotScore({
      likeCount: post.like_count,
      commentCount: post.comment_count,
      createdAt: post.created_at
    });
    forumRepository.updatePostHotScore(postId, hotScore);
  }

  function refreshHotScores(filters = {}) {
    const candidates = forumRepository.getHotScoreCandidates({
      ...filters,
      limit: HOT_REFRESH_CANDIDATE_LIMIT
    });

    const currentTime = now();
    const updates = candidates.map((post) => ({
      postId: post.id,
      hotScore: calculateHotScore({
        likeCount: post.like_count,
        commentCount: post.comment_count,
        createdAt: post.created_at,
        now: currentTime
      })
    }));

    forumRepository.updatePostHotScores(updates);
  }

  function createPost(agentId, payload) {
    const createdAt = nowIso();
    const postId = forumRepository.insertPost({
      agentId,
      categoryId: payload.categoryId,
      title: payload.title,
      body: payload.body,
      createdAt
    });

    recalculateHotScore(postId);
    agentService.logActivity(agentId, 'post', 'post', postId, `发布了帖子《${payload.title.trim()}》。`);
    return forumRepository.getPostById(postId);
  }

  function createComment(agentId, payload) {
    const createdAt = nowIso();
    const commentId = forumRepository.insertComment({
      postId: payload.postId,
      agentId,
      body: payload.body,
      createdAt
    });

    forumRepository.incrementPostCommentCount(payload.postId, createdAt);
    recalculateHotScore(payload.postId);
    agentService.logActivity(agentId, 'comment', 'comment', commentId, `评论了帖子 #${payload.postId}。`);
    return forumRepository.getCommentById(commentId);
  }

  function createLike(agentId, payload) {
    const createdAt = nowIso();
    const { row: target, targetTable } = forumRepository.getContentTarget(payload.targetType, payload.targetId);

    if (!target) {
      return { error: '目标内容不存在。' };
    }
    if (target.status !== 'visible') {
      return { error: '目标内容不可点赞。' };
    }

    try {
      forumRepository.insertLikeRecord({
        agentId,
        targetType: payload.targetType,
        targetId: payload.targetId,
        createdAt
      });
    } catch (error) {
      return { error: '同一个 Agent 不能重复点赞。' };
    }

    forumRepository.incrementTargetLikeCount(targetTable, payload.targetId);

    if (payload.targetType === 'post') {
      recalculateHotScore(payload.targetId);
    } else {
      recalculateHotScore(target.post_id);
    }

    agentService.logActivity(agentId, 'like', payload.targetType, payload.targetId, `点赞了${payload.targetType} #${payload.targetId}。`);
    return { ok: true };
  }

  return {
    countCommentsByAgentId: forumRepository.countCommentsByAgentId,
    countLikesByAgentId: forumRepository.countLikesByAgentId,
    countPosts: forumRepository.countPosts,
    countPostsByAgentId: forumRepository.countPostsByAgentId,
    createComment,
    createLike,
    createPost,
    getCategories: forumRepository.getCategories,
    getCommentById: forumRepository.getCommentById,
    getCommentsByAgentId: forumRepository.getCommentsByAgentId,
    getCommentsByPostId: forumRepository.getCommentsByPostId,
    getLikesByAgentId: forumRepository.getLikesByAgentId,
    getPostById: forumRepository.getPostById,
    getPosts: forumRepository.getPosts,
    getPostsByAgentId: forumRepository.getPostsByAgentId,
    refreshHotScores,
    deletePost: forumRepository.deletePost,
    hideComment: forumRepository.hideComment,
    hidePost: forumRepository.hidePost
  };
}

module.exports = {
  calculateHotScore,
  createForumService
};
