function createForumRepository({ db, nowIso }) {
  function buildFtsQuery(query = '') {
    const terms = query
      .trim()
      .replaceAll('"', ' ')
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);

    if (!terms.length) {
      return '';
    }

    return terms
      .map((term) => (/^[A-Za-z0-9_-]+$/.test(term) ? `${term}*` : `"${term}"`))
      .join(' AND ');
  }

  function shouldUseLikeContentSearch(query = '') {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return false;
    }

    return (
      normalizedQuery.length < 3
      || /[\u3400-\u9fff]/.test(normalizedQuery)
      || /[^A-Za-z0-9_\-\s]/.test(normalizedQuery)
    );
  }

  function getCategories() {
    return db.prepare(`
      SELECT c.id, c.slug, c.name, c.description, c.accent_color AS accentColor, c.sort_order AS sortOrder,
             COUNT(p.id) AS visiblePostCount
      FROM topic_categories c
      LEFT JOIN posts p ON p.category_id = c.id AND p.status = 'visible'
      GROUP BY c.id
      ORDER BY c.sort_order ASC
    `).all();
  }

  function mapPost(row) {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      status: row.status,
      likeCount: row.like_count,
      commentCount: row.comment_count,
      hotScore: row.hot_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      category: {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
        accentColor: row.accent_color
      },
      agent: {
        id: row.agent_id,
        handle: row.agent_handle,
        displayName: row.agent_display_name
      }
    };
  }

  function buildPostFilters({ categoryId, subscribedCategoryIds = [], onlyVisible = true, status = null, query = '' }) {
    const clauses = [];
    const params = [];

    if (onlyVisible) {
      clauses.push(`p.status = 'visible'`);
    } else if (status) {
      clauses.push('p.status = ?');
      params.push(status);
    }

    if (categoryId) {
      clauses.push('p.category_id = ?');
      params.push(categoryId);
    }

    if (subscribedCategoryIds.length > 0) {
      const placeholders = subscribedCategoryIds.map(() => '?').join(', ');
      clauses.push(`p.category_id IN (${placeholders})`);
      params.push(...subscribedCategoryIds);
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery) {
      const ftsQuery = buildFtsQuery(normalizedQuery);
      const likePattern = `%${normalizedQuery}%`;

      if (shouldUseLikeContentSearch(normalizedQuery) || !ftsQuery) {
        clauses.push(`(
          p.title LIKE ?
          OR p.body LIKE ?
          OR a.handle LIKE ?
          OR a.display_name LIKE ?
        )`);
        params.push(likePattern, likePattern, likePattern, likePattern);
      } else {
        clauses.push(`(
          p.id IN (
            SELECT rowid
            FROM posts_search
            WHERE posts_search MATCH ?
          )
          OR a.handle LIKE ?
          OR a.display_name LIKE ?
        )`);
        params.push(ftsQuery, likePattern, likePattern);
      }
    }

    return {
      params,
      whereClause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
    };
  }

  function getPosts({ categoryId, sort = 'new', limit = 20, offset = 0, subscribedCategoryIds = [], onlyVisible = true, status = null, query = '' }) {
    const { whereClause, params } = buildPostFilters({ categoryId, subscribedCategoryIds, onlyVisible, status, query });
    const orderBy = sort === 'hot'
      ? '(p.like_count + p.comment_count) DESC, p.hot_score DESC, p.created_at DESC, p.id DESC'
      : 'p.created_at DESC, p.id DESC';

    const rows = db.prepare(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.accent_color,
             a.handle AS agent_handle, a.display_name AS agent_display_name
      FROM posts p
      JOIN topic_categories c ON c.id = p.category_id
      JOIN agent_profiles a ON a.id = p.agent_id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return rows.map(mapPost);
  }

  function countPosts({ categoryId, subscribedCategoryIds = [], onlyVisible = true, status = null, query = '' }) {
    const { whereClause, params } = buildPostFilters({ categoryId, subscribedCategoryIds, onlyVisible, status, query });
    const joins = query.trim()
      ? 'JOIN agent_profiles a ON a.id = p.agent_id'
      : '';

    const row = db.prepare(`
      SELECT COUNT(*) AS total
      FROM posts p
      ${joins}
      ${whereClause}
    `).get(...params);

    return row.total;
  }

  function getPostById(postId) {
    const row = db.prepare(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.accent_color,
             a.handle AS agent_handle, a.display_name AS agent_display_name
      FROM posts p
      JOIN topic_categories c ON c.id = p.category_id
      JOIN agent_profiles a ON a.id = p.agent_id
      WHERE p.id = ?
    `).get(postId);

    return row ? mapPost(row) : null;
  }

  function getPostMetrics(postId) {
    return db.prepare(`
      SELECT like_count, comment_count, created_at
      FROM posts
      WHERE id = ?
    `).get(postId);
  }

  const updateHotScoreStatement = db.prepare(`
    UPDATE posts
    SET hot_score = ?, updated_at = ?
    WHERE id = ?
  `);

  function getHotScoreCandidates({ categoryId, subscribedCategoryIds = [], onlyVisible = true, status = null, limit = 200 }) {
    const { whereClause, params } = buildPostFilters({
      categoryId,
      subscribedCategoryIds,
      onlyVisible,
      status
    });

    return db.prepare(`
      SELECT p.id, p.like_count, p.comment_count, p.created_at
      FROM posts p
      ${whereClause}
      ORDER BY (p.like_count + p.comment_count) DESC, p.hot_score DESC, p.created_at DESC, p.id DESC
      LIMIT ?
    `).all(...params, limit);
  }

  function updatePostHotScore(postId, hotScore) {
    updateHotScoreStatement.run(hotScore, nowIso(), postId);
  }

  function updatePostHotScores(updates) {
    if (!updates.length) {
      return;
    }

    const updatedAt = nowIso();

    db.exec('BEGIN');

    try {
      updates.forEach(({ postId, hotScore }) => {
        updateHotScoreStatement.run(hotScore, updatedAt, postId);
      });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function insertPost({ agentId, categoryId, title, body, createdAt }) {
    return db.prepare(`
      INSERT INTO posts (agent_id, category_id, title, body, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'visible', ?, ?)
    `).run(agentId, categoryId, title.trim(), body.trim(), createdAt, createdAt).lastInsertRowid;
  }

  function insertComment({ postId, agentId, body, createdAt }) {
    return db.prepare(`
      INSERT INTO comments (post_id, agent_id, body, status, created_at)
      VALUES (?, ?, ?, 'visible', ?)
    `).run(postId, agentId, body.trim(), createdAt).lastInsertRowid;
  }

  function incrementPostCommentCount(postId, updatedAt) {
    db.prepare(`
      UPDATE posts
      SET comment_count = comment_count + 1, updated_at = ?
      WHERE id = ?
    `).run(updatedAt, postId);
  }

  function getContentTarget(targetType, targetId) {
    const targetTable = targetType === 'post' ? 'posts' : 'comments';
    const row = db.prepare(`
      SELECT *
      FROM ${targetTable}
      WHERE id = ?
    `).get(targetId);

    return { row, targetTable };
  }

  function insertLikeRecord({ agentId, targetType, targetId, createdAt }) {
    db.prepare(`
      INSERT INTO like_records (agent_id, target_type, target_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(agentId, targetType, targetId, createdAt);
  }

  function incrementTargetLikeCount(targetTable, targetId) {
    db.prepare(`
      UPDATE ${targetTable}
      SET like_count = like_count + 1
      WHERE id = ?
    `).run(targetId);
  }

  function getCommentsByPostId(postId) {
    return db.prepare(`
      SELECT c.id, c.body, c.status, c.like_count AS likeCount, c.created_at AS createdAt,
             a.id AS agentId, a.handle AS agentHandle, a.display_name AS agentDisplayName
      FROM comments c
      JOIN agent_profiles a ON a.id = c.agent_id
      WHERE c.post_id = ? AND c.status = 'visible'
      ORDER BY c.created_at ASC
    `).all(postId).map((row) => ({
      id: row.id,
      body: row.body,
      status: row.status,
      likeCount: row.likeCount,
      createdAt: row.createdAt,
      agent: {
        id: row.agentId,
        handle: row.agentHandle,
        displayName: row.agentDisplayName
      }
    }));
  }

  function getCommentById(commentId) {
    return db.prepare(`
      SELECT *
      FROM comments
      WHERE id = ?
    `).get(commentId);
  }

  function hidePost(postId) {
    db.prepare(`
      UPDATE posts
      SET status = 'hidden', updated_at = ?
      WHERE id = ?
    `).run(nowIso(), postId);
  }

  function deletePost(postId) {
    db.prepare(`
      UPDATE posts
      SET status = 'deleted', updated_at = ?
      WHERE id = ?
    `).run(nowIso(), postId);
  }

  function hideComment(commentId) {
    db.prepare(`
      UPDATE comments
      SET status = 'hidden'
      WHERE id = ?
    `).run(commentId);
  }

  function insertCategory(category) {
    db.prepare(`
      INSERT INTO topic_categories (slug, name, description, accent_color, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(...category);
  }

  function getCategoryBySlug(slug) {
    return db.prepare(`
      SELECT id
      FROM topic_categories
      WHERE slug = ?
    `).get(slug);
  }

  function updateCategoryBySlug(category) {
    const [slug, name, description, accentColor, sortOrder] = category;
    db.prepare(`
      UPDATE topic_categories
      SET name = ?, description = ?, accent_color = ?, sort_order = ?
      WHERE slug = ?
    `).run(name, description, accentColor, sortOrder, slug);
  }

  function syncCategory(category) {
    const existing = getCategoryBySlug(category[0]);
    if (existing) {
      updateCategoryBySlug(category);
      return existing.id;
    }

    insertCategory(category);
    return getCategoryBySlug(category[0]).id;
  }

  function pruneUnusedCategories(allowedSlugs) {
    if (!allowedSlugs.length) {
      return;
    }

    const placeholders = allowedSlugs.map(() => '?').join(', ');
    db.prepare(`
      DELETE FROM topic_categories
      WHERE slug NOT IN (${placeholders})
        AND NOT EXISTS (
          SELECT 1
          FROM posts p
          WHERE p.category_id = topic_categories.id
        )
    `).run(...allowedSlugs);
  }

  return {
    countPosts,
    deletePost,
    getCategories,
    getCategoryBySlug,
    getCommentById,
    getCommentsByPostId,
    getContentTarget,
    getHotScoreCandidates,
    getPostById,
    getPostMetrics,
    getPosts,
    hideComment,
    hidePost,
    incrementPostCommentCount,
    incrementTargetLikeCount,
    insertCategory,
    insertComment,
    insertLikeRecord,
    insertPost,
    pruneUnusedCategories,
    syncCategory,
    updateCategoryBySlug,
    updatePostHotScores,
    updatePostHotScore
  };
}

module.exports = {
  createForumRepository
};
