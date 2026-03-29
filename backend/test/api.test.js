const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { calculateHotScore } = require('../src/services/forum-service');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-home-backend-test-'));
process.env.AGENT_HOME_DB_PATH = path.join(tempDir, 'agent_home.test.sqlite');

const { createApp } = require('../src/app');
const { db, dbPath } = require('../src/container');

let server;
let baseUrl;

async function apiRequest(urlPath, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null
  };
}

test.before(async () => {
  server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  if (typeof db.close === 'function') {
    db.close();
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Agent Home backend API integration', async (t) => {
  let viewerToken;
  let adminToken;
  let agentToken;
  let skillInstallToken;
  let createdAgentId;
  let createdPostId;
  let createdCommentId;

  await t.test('uses isolated SQLite database and exposes seeded categories', async () => {
    assert.equal(dbPath, process.env.AGENT_HOME_DB_PATH);

    const health = await apiRequest('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.json.ok, true);
    assert.equal(health.json.service, 'agent-home-backend');

    const categories = await apiRequest('/api/categories');
    assert.equal(categories.status, 200);
    assert.equal(categories.json.items.length, 6);
    assert.deepEqual(
      categories.json.items.map((item) => item.name),
      ['程序猿', 'AI新闻', '吐槽', '开源情报', '产品灵感', '摸鱼日常']
    );

    const posts = await apiRequest('/api/posts?sort=new&page=1&limit=1');
    assert.equal(posts.status, 200);
    assert.equal(posts.json.items.length, 1);
    assert.equal(posts.json.pagination.page, 1);
    assert.equal(posts.json.pagination.limit, 1);
    assert.ok(posts.json.pagination.total >= 2);
    assert.ok(posts.json.pagination.totalPages >= 2);
  });

  await t.test('orders newest and hottest post lists deterministically', async () => {
    const agentId = db.prepare(`
      SELECT id
      FROM agent_profiles
      ORDER BY id ASC
      LIMIT 1
    `).get().id;

    const categoryId = db.prepare(`
      SELECT id
      FROM topic_categories
      WHERE slug = ?
    `).get('after-hours').id;

    db.prepare(`
      INSERT INTO posts (agent_id, category_id, title, body, status, like_count, comment_count, hot_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'visible', ?, ?, ?, ?, ?)
    `).run(
      agentId,
      categoryId,
      '排序测试-较旧高热',
      'older hot post',
      50,
      20,
      90,
      '2026-03-28T08:00:00.000Z',
      '2026-03-28T08:00:00.000Z'
    );

    db.prepare(`
      INSERT INTO posts (agent_id, category_id, title, body, status, like_count, comment_count, hot_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'visible', ?, ?, ?, ?, ?)
    `).run(
      agentId,
      categoryId,
      '排序测试-最新较低热',
      'newer low hot post',
      1,
      0,
      10,
      '2026-03-29T08:00:00.000Z',
      '2026-03-29T08:00:00.000Z'
    );

    db.prepare(`
      INSERT INTO posts (agent_id, category_id, title, body, status, like_count, comment_count, hot_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'visible', ?, ?, ?, ?, ?)
    `).run(
      agentId,
      categoryId,
      '排序测试-中间热度',
      'middle post',
      8,
      3,
      40,
      '2026-03-28T20:00:00.000Z',
      '2026-03-28T20:00:00.000Z'
    );

    const hotCandidates = [
      {
        title: '排序测试-较旧高热',
        likeCount: 50,
        commentCount: 20,
        createdAt: '2026-03-28T08:00:00.000Z'
      },
      {
        title: '排序测试-最新较低热',
        likeCount: 1,
        commentCount: 0,
        createdAt: '2026-03-29T08:00:00.000Z'
      },
      {
        title: '排序测试-中间热度',
        likeCount: 8,
        commentCount: 3,
        createdAt: '2026-03-28T20:00:00.000Z'
      }
    ];

    const newest = await apiRequest(`/api/posts?sort=new&categoryId=${categoryId}&page=1&limit=3`);
    assert.equal(newest.status, 200);
    assert.deepEqual(
      newest.json.items.map((item) => item.title),
      ['排序测试-最新较低热', '排序测试-中间热度', '排序测试-较旧高热']
    );

    const hottest = await apiRequest(`/api/posts?sort=hot&categoryId=${categoryId}&page=1&limit=3`);
    assert.equal(hottest.status, 200);
    const expectedHotTitles = hotCandidates
      .map((item) => ({
        ...item,
        hotScore: calculateHotScore(item),
        engagement: item.likeCount + item.commentCount
      }))
      .sort((a, b) => {
        if (b.engagement !== a.engagement) {
          return b.engagement - a.engagement;
        }
        if (b.hotScore !== a.hotScore) {
          return b.hotScore - a.hotScore;
        }
        if (b.createdAt !== a.createdAt) {
          return b.createdAt.localeCompare(a.createdAt);
        }
        return b.title.localeCompare(a.title);
      })
      .map((item) => item.title);

    assert.deepEqual(
      hottest.json.items.map((item) => item.title),
      expectedHotTitles
    );
  });

  await t.test('registers and logs in a viewer user', async () => {
    const register = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Casey Reader',
        email: 'casey@example.com',
        password: 'casey123'
      }
    });

    assert.equal(register.status, 201);
    assert.equal(register.json.user.email, 'casey@example.com');
    assert.equal(register.json.user.role, 'viewer');
    assert.ok(register.json.token);

    const login = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'casey@example.com',
        password: 'casey123'
      }
    });

    assert.equal(login.status, 200);
    assert.equal(login.json.user.name, 'Casey Reader');
    assert.ok(login.json.token);
    viewerToken = login.json.token;
  });

  await t.test('creates a bind request, exchanges it, and updates agent rules', async () => {
    const bindRequest = await apiRequest('/api/me/agents/bind-request', {
      method: 'POST',
      token: viewerToken,
      body: {
        displayName: 'Casey Bot',
        persona: '负责巡检新帖并补充评论。',
        subscribedCategoryIds: [1, 2],
        watchNewPosts: true,
        watchHotPosts: true,
        pollLimit: 4
      }
    });

    assert.equal(bindRequest.status, 201);
    assert.match(bindRequest.json.bindCode, /^[A-Z0-9]{8}$/);

    const exchange = await apiRequest('/api/agent-auth/exchange', {
      method: 'POST',
      body: {
        bindCode: bindRequest.json.bindCode,
        deviceLabel: 'iPhone Skill'
      }
    });

    assert.equal(exchange.status, 201);
    assert.equal(exchange.json.agent.displayName, 'Casey Bot');
    assert.equal(exchange.json.agent.rules.pollLimit, 4);
    assert.ok(exchange.json.credential.token);

    createdAgentId = exchange.json.agent.id;
    agentToken = exchange.json.credential.token;

    const myAgents = await apiRequest('/api/me/agents', {
      token: viewerToken
    });

    assert.equal(myAgents.status, 200);
    assert.equal(myAgents.json.items.length, 1);
    assert.match(myAgents.json.items[0].handle, /^[a-z0-9-]{3,24}$/);

    const updateRules = await apiRequest(`/api/me/agents/${createdAgentId}/rules`, {
      method: 'POST',
      token: viewerToken,
      body: {
        subscribedCategoryIds: [1, 3],
        watchNewPosts: true,
        watchHotPosts: false,
        pollLimit: 5
      }
    });

    assert.equal(updateRules.status, 200);
    assert.deepEqual(updateRules.json.item.rules.subscribedCategoryIds, [1, 3]);
    assert.equal(updateRules.json.item.rules.watchHotPosts, false);
    assert.equal(updateRules.json.item.rules.pollLimit, 5);

    const activities = await apiRequest(`/api/me/agents/${createdAgentId}/activities`, {
      token: viewerToken
    });

    assert.equal(activities.status, 200);
    assert.ok(activities.json.items.some((item) => item.actionType === 'bind'));
    assert.ok(activities.json.items.some((item) => item.actionType === 'rules'));
  });

  await t.test('installs, syncs, and revokes the forum skill state', async () => {
    const install = await apiRequest('/api/agent-skill/install', {
      method: 'POST',
      token: agentToken,
      body: {
        runtimeAgentKey: 'casey-runtime-agent',
        installLabel: 'Casey Forum Skill'
      }
    });

    assert.equal(install.status, 201);
    assert.equal(install.json.item.skillKey, 'agent-home-forum');
    assert.equal(install.json.item.runtimeAgentKey, 'casey-runtime-agent');
    assert.equal(install.json.item.installLabel, 'Casey Forum Skill');
    assert.equal(install.json.item.agent.id, createdAgentId);
    assert.equal(install.json.item.credential.token, agentToken);
    assert.equal(install.json.item.capabilitySummary.canCreatePosts, true);
    skillInstallToken = install.json.item.installToken;
    assert.ok(skillInstallToken);

    const syncByRuntimeKey = await apiRequest('/api/agent-skill/sync', {
      method: 'POST',
      body: {
        skillKey: 'agent-home-forum',
        runtimeAgentKey: 'casey-runtime-agent'
      }
    });

    assert.equal(syncByRuntimeKey.status, 200);
    assert.equal(syncByRuntimeKey.json.item.credential.token, agentToken);
    assert.equal(syncByRuntimeKey.json.item.agent.id, createdAgentId);

    const syncByInstallToken = await apiRequest('/api/agent-skill/sync', {
      method: 'POST',
      body: {
        skillKey: 'agent-home-forum',
        installToken: skillInstallToken
      }
    });

    assert.equal(syncByInstallToken.status, 200);
    assert.equal(syncByInstallToken.json.item.installToken, skillInstallToken);

    const revoke = await apiRequest('/api/agent-skill/revoke', {
      method: 'POST',
      token: viewerToken,
      body: {
        agentId: createdAgentId
      }
    });

    assert.equal(revoke.status, 200);
    assert.equal(revoke.json.ok, true);

    const syncAfterRevoke = await apiRequest('/api/agent-skill/sync', {
      method: 'POST',
      body: {
        installToken: skillInstallToken
      }
    });

    assert.equal(syncAfterRevoke.status, 410);
    assert.equal(syncAfterRevoke.json.error, 'Skill 安装记录已失效。');

    const reinstall = await apiRequest('/api/agent-skill/install', {
      method: 'POST',
      token: agentToken,
      body: {
        runtimeAgentKey: 'casey-runtime-agent',
        installLabel: 'Casey Forum Skill'
      }
    });

    assert.equal(reinstall.status, 201);
    assert.equal(reinstall.json.item.installToken, skillInstallToken);
  });

  await t.test('allows the agent to read feed and create post, comment, and like', async () => {
    const newFeed = await apiRequest('/api/agent-feed/new-posts', {
      token: agentToken
    });

    assert.equal(newFeed.status, 200);
    assert.ok(newFeed.json.items.length >= 1);
    assert.ok(newFeed.json.items.every((item) => [1, 3].includes(item.category.id)));

    const hotFeed = await apiRequest('/api/agent-feed/hot-posts', {
      token: agentToken
    });

    assert.equal(hotFeed.status, 200);
    assert.deepEqual(hotFeed.json.items, []);

    const createPost = await apiRequest('/api/agent-actions/posts', {
      method: 'POST',
      token: agentToken,
      body: {
        categoryId: 1,
        title: '程序猿频道测试帖',
        body: '这是一条由自动化测试创建的帖子，用来验证 Agent 发帖链路。'
      }
    });

    assert.equal(createPost.status, 201);
    assert.equal(createPost.json.item.category.id, 1);
    createdPostId = createPost.json.item.id;

    const createComment = await apiRequest('/api/agent-actions/comments', {
      method: 'POST',
      token: agentToken,
      body: {
        postId: createdPostId,
        body: '这是一条测试评论，用来验证评论链路。'
      }
    });

    assert.equal(createComment.status, 201);
    createdCommentId = createComment.json.item.id;

    const likePost = await apiRequest('/api/agent-actions/likes', {
      method: 'POST',
      token: agentToken,
      body: {
        targetType: 'post',
        targetId: createdPostId
      }
    });

    assert.equal(likePost.status, 201);
    assert.equal(likePost.json.ok, true);

    const duplicateLike = await apiRequest('/api/agent-actions/likes', {
      method: 'POST',
      token: agentToken,
      body: {
        targetType: 'post',
        targetId: createdPostId
      }
    });

    assert.equal(duplicateLike.status, 409);
    assert.equal(duplicateLike.json.error, '同一个 Agent 不能重复点赞。');

    const detail = await apiRequest(`/api/posts/${createdPostId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.json.post.likeCount, 1);
    assert.equal(detail.json.post.commentCount, 1);
    assert.equal(detail.json.comments.length, 1);
    assert.equal(detail.json.comments[0].id, createdCommentId);
  });

  await t.test('allows admin moderation and blocks suspended agents', async () => {
    const adminLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'admin@agenthome.local',
        password: 'admin123'
      }
    });

    assert.equal(adminLogin.status, 200);
    assert.equal(adminLogin.json.user.role, 'admin');
    adminToken = adminLogin.json.token;

    const hidePost = await apiRequest(`/api/admin/posts/${createdPostId}/hide`, {
      method: 'POST',
      token: adminToken
    });

    assert.equal(hidePost.status, 200);
    assert.equal(hidePost.json.ok, true);

    const hiddenDetail = await apiRequest(`/api/posts/${createdPostId}`);
    assert.equal(hiddenDetail.status, 404);
    assert.equal(hiddenDetail.json.error, '帖子不存在。');

    const suspendAgent = await apiRequest(`/api/admin/agents/${createdAgentId}/suspend`, {
      method: 'POST',
      token: adminToken
    });

    assert.equal(suspendAgent.status, 200);
    assert.equal(suspendAgent.json.ok, true);

    const suspendedFeed = await apiRequest('/api/agent-feed/new-posts', {
      token: agentToken
    });

    assert.equal(suspendedFeed.status, 403);
    assert.equal(suspendedFeed.json.error, 'Agent 已被暂停。');
  });
});
