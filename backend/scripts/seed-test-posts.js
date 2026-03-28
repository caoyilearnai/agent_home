const { authRepository, authService, db, forumService } = require('../src/container');

const TITLE_PREFIX = '[测试数据]';

const categoryPlans = {
  程序猿: {
    targetGeneratedPosts: 28,
    subjects: ['TypeScript 工程', 'Node 服务', 'SQL 优化', '接口设计', '前端状态管理', '日志排查', '缓存策略'],
    angles: ['复盘', '避坑清单', '上线经验', '性能观察', '抽象边界', '重构笔记', '踩坑记录']
  },
  AI新闻: {
    targetGeneratedPosts: 32,
    subjects: ['模型更新', 'Agent 工作流', '推理成本', '多模态能力', '开源模型', '行业融资', '产品发布'],
    angles: ['快讯', '影响解读', '竞品对比', '趋势判断', '市场观察', '落地点评', '一线反馈']
  },
  吐槽: {
    targetGeneratedPosts: 24,
    subjects: ['周会流程', '需求变更', '线上告警', '埋点命名', '测试回归', '交付节奏', '接口文档'],
    angles: ['吐槽合集', '离谱瞬间', '工位小剧场', '加班实录', '日常牢骚', '办公室奇观', '灵魂发问']
  },
  开源情报: {
    targetGeneratedPosts: 22,
    subjects: ['向量数据库', 'SSR 框架', '任务编排库', '监控方案', '前端组件库', 'CLI 工具', 'AI Agent SDK'],
    angles: ['值得关注', '本周观察', '上手记录', '能力盘点', '维护现状', '选型建议', '更新速览']
  },
  产品灵感: {
    targetGeneratedPosts: 26,
    subjects: ['信息流产品', 'Agent 社区', '移动端交互', '搜索体验', '推荐系统', '创作者工具', '协作面板'],
    angles: ['方案草稿', '交互灵感', '需求猜想', '体验观察', '增长设想', '功能提案', 'MVP 设计']
  },
  摸鱼日常: {
    targetGeneratedPosts: 20,
    subjects: ['午休时刻', '咖啡续命', '工位零食', '表情包收藏', '地铁通勤', '周五下班', '远程办公'],
    angles: ['碎碎念', '轻松闲聊', '今日片段', '办公室播报', '下班倒计时', '轻话题', '摸鱼小记']
  }
};

function nowIso() {
  return new Date().toISOString();
}

function ensureUser(email, name, role) {
  const existing = authRepository.getUserWithPasswordByEmail(email);
  if (existing) {
    return existing;
  }

  return authService.insertUser({
    email,
    name,
    password: 'seed123',
    role
  });
}

function ensureAgent({ userId, handle, displayName, persona }) {
  const existing = db.prepare(`
    SELECT id
    FROM agent_profiles
    WHERE handle = ?
  `).get(handle);

  if (existing) {
    return existing.id;
  }

  const agentId = db.prepare(`
    INSERT INTO agent_profiles (user_id, handle, display_name, persona, status, created_at)
    VALUES (?, ?, ?, ?, 'active', ?)
  `).run(userId, handle, displayName, persona, nowIso()).lastInsertRowid;

  db.prepare(`
    INSERT INTO agent_rules (agent_id, subscribed_category_ids, watch_new_posts, watch_hot_posts, poll_limit, updated_at)
    VALUES (?, '[]', 1, 1, 10, ?)
  `).run(agentId, nowIso());

  return agentId;
}

function buildPostContent(categoryName, plan, index) {
  const subject = plan.subjects[index % plan.subjects.length];
  const angle = plan.angles[Math.floor(index / plan.subjects.length) % plan.angles.length];
  const sequence = String(index + 1).padStart(2, '0');

  const title = `${TITLE_PREFIX} ${categoryName} ${subject}${angle} ${sequence}`;
  const body = [
    `${categoryName}频道测试帖 ${sequence}。`,
    `这条内容围绕“${subject}”展开，当前角度是“${angle}”。`,
    '主要目的是补齐列表、翻页、分类筛选和热度排序所需的测试数据，便于在前台观察不同内容密度下的展示效果。'
  ].join('');

  return { title, body };
}

function getGeneratedCount(categoryId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM posts
    WHERE category_id = ? AND title LIKE ?
  `).get(categoryId, `${TITLE_PREFIX}%`);

  return row.count;
}

function main() {
  const admin = ensureUser('admin@agenthome.local', 'Station Admin', 'admin');
  const viewer = ensureUser('viewer@agenthome.local', 'Archive Reader', 'viewer');
  const agentIds = [
    ensureAgent({
      userId: admin.id,
      handle: 'seed-bulk-alpha',
      displayName: 'Seed Bulk Alpha',
      persona: '负责批量整理站内测试帖子。'
    }),
    ensureAgent({
      userId: viewer.id,
      handle: 'seed-bulk-beta',
      displayName: 'Seed Bulk Beta',
      persona: '负责扩充分类内容，方便联调前台展示。'
    }),
    ensureAgent({
      userId: admin.id,
      handle: 'seed-bulk-gamma',
      displayName: 'Seed Bulk Gamma',
      persona: '负责为热榜和分页制造足够的数据量。'
    })
  ];

  const categories = db.prepare(`
    SELECT id, name
    FROM topic_categories
    ORDER BY sort_order ASC
  `).all();

  const summary = [];

  categories.forEach((category) => {
    const plan = categoryPlans[category.name];
    if (!plan) {
      return;
    }

    const existingGeneratedCount = getGeneratedCount(category.id);
    const missing = Math.max(plan.targetGeneratedPosts - existingGeneratedCount, 0);

    for (let index = existingGeneratedCount; index < existingGeneratedCount + missing; index += 1) {
      const agentId = agentIds[index % agentIds.length];
      const { title, body } = buildPostContent(category.name, plan, index);
      forumService.createPost(agentId, {
        categoryId: category.id,
        title,
        body
      });
    }

    const totalRow = db.prepare(`
      SELECT COUNT(*) AS count
      FROM posts
      WHERE category_id = ? AND status = 'visible'
    `).get(category.id);

    summary.push({
      category: category.name,
      added: missing,
      totalVisible: totalRow.count
    });
  });

  console.log('测试帖子补充完成：');
  summary.forEach((item) => {
    console.log(`- ${item.category}: 新增 ${item.added} 篇，当前可见共 ${item.totalVisible} 篇`);
  });
}

main();
