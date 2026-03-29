import { useEffect, useState } from 'react';
import { Panel } from './Layout';
import { formatDate } from '../utils';

function CategorySelector({ categories, value, onChange }) {
  const allSelected = categories.length > 0 && value.length === categories.length;

  function toggleCategory(categoryId) {
    if (value.includes(categoryId)) {
      onChange(value.filter((item) => item !== categoryId));
      return;
    }

    onChange([...value, categoryId]);
  }

  function toggleAll() {
    onChange(allSelected ? [] : categories.map((category) => category.id));
  }

  return (
    <div className="category-selector">
      <div className="button-row">
        <span className="small-copy">订阅分类</span>
        <button className="ghost-button" type="button" onClick={toggleAll}>
          {allSelected ? '取消全选' : '全选分类'}
        </button>
      </div>
      <div className="category-selector-grid">
        {categories.map((category) => {
          const active = value.includes(category.id);
          return (
            <button
              key={category.id}
              className={`category-option ${active ? 'active' : ''}`}
              type="button"
              onClick={() => toggleCategory(category.id)}
            >
              <span className="category-option-dot" style={{ background: category.accentColor }} />
              <span className="category-option-name">{category.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function mapCategoryNames(categoryIds, categories) {
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
  return categoryIds.map((id) => categoryMap.get(id)).filter(Boolean);
}

function BindForm({ categories, onCreate, busy }) {
  const [form, setForm] = useState({
    displayName: '',
    persona: '',
    subscribedCategoryIds: [],
    pollLimit: '8'
  });

  useEffect(() => {
    if (categories.length === 0) {
      return;
    }

    setForm((current) => (
      current.subscribedCategoryIds.length > 0
        ? current
        : { ...current, subscribedCategoryIds: categories.map((category) => category.id) }
    ));
  }, [categories]);

  function updateField(key) {
    return (event) => {
      setForm((current) => ({ ...current, [key]: event.target.value }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onCreate({
      displayName: form.displayName,
      persona: form.persona,
      subscribedCategoryIds: form.subscribedCategoryIds,
      pollLimit: Number(form.pollLimit),
      watchNewPosts: true,
      watchHotPosts: true
    });
  }

  return (
    <form className="bind-form" onSubmit={handleSubmit}>
      <label>
        <span>Agent 显示名称</span>
        <input value={form.displayName} onChange={updateField('displayName')} placeholder="Chronicle Desk" required />
      </label>
      <div className="small-copy">系统会根据名称自动生成内部唯一标识，无需手动填写。</div>
      <label>
        <span>角色设定</span>
        <textarea value={form.persona} onChange={updateField('persona')} placeholder="说明这个 Agent 的职责和语气" required />
      </label>
      <CategorySelector
        categories={categories}
        value={form.subscribedCategoryIds}
        onChange={(subscribedCategoryIds) => setForm((current) => ({ ...current, subscribedCategoryIds }))}
      />
      <label>
        <span>单次拉贴数上限</span>
        <input type="number" min="1" max="20" value={form.pollLimit} onChange={updateField('pollLimit')} />
      </label>
      <div className="button-row">
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? '生成中...' : '生成绑定码'}
        </button>
      </div>
    </form>
  );
}

function RuleEditor({ agent, categories, onSave, busy }) {
  const [values, setValues] = useState({
    subscribedCategoryIds: agent.rules.subscribedCategoryIds,
    pollLimit: String(agent.rules.pollLimit),
    watchNewPosts: agent.rules.watchNewPosts,
    watchHotPosts: agent.rules.watchHotPosts
  });

  useEffect(() => {
    setValues({
      subscribedCategoryIds: agent.rules.subscribedCategoryIds,
      pollLimit: String(agent.rules.pollLimit),
      watchNewPosts: agent.rules.watchNewPosts,
      watchHotPosts: agent.rules.watchHotPosts
    });
  }, [agent]);

  function updateText(key) {
    return (event) => {
      setValues((current) => ({ ...current, [key]: event.target.value }));
    };
  }

  function updateToggle(key) {
    return (event) => {
      setValues((current) => ({ ...current, [key]: event.target.checked }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSave(agent.id, {
      subscribedCategoryIds: values.subscribedCategoryIds,
      pollLimit: Number(values.pollLimit),
      watchNewPosts: values.watchNewPosts,
      watchHotPosts: values.watchHotPosts
    });
  }

  return (
    <form className="rule-form" onSubmit={handleSubmit}>
      <CategorySelector
        categories={categories}
        value={values.subscribedCategoryIds}
        onChange={(subscribedCategoryIds) => setValues((current) => ({ ...current, subscribedCategoryIds }))}
      />
      <label>
        <span>单次拉贴数上限</span>
        <input type="number" min="1" max="20" value={values.pollLimit} onChange={updateText('pollLimit')} />
      </label>
      <label className="switch-row">
        <input type="checkbox" checked={values.watchNewPosts} onChange={updateToggle('watchNewPosts')} />
        <span>监听新帖</span>
      </label>
      <label className="switch-row">
        <input type="checkbox" checked={values.watchHotPosts} onChange={updateToggle('watchHotPosts')} />
        <span>监听热帖</span>
      </label>
      <div className="button-row">
        <button className="secondary-button" type="submit" disabled={busy}>
          {busy ? '保存中...' : '保存规则'}
        </button>
      </div>
    </form>
  );
}

function AgentCard({ agent, activities, categories, onSaveRules, busy }) {
  const [expanded, setExpanded] = useState(false);
  const subscribedCategoryNames = mapCategoryNames(agent.rules.subscribedCategoryIds, categories);

  return (
    <article className="agent-card">
      <div className="agent-card-head">
        <div>
          <div className="agent-meta">
            <span>@{agent.handle}</span>
            <span>{agent.displayName}</span>
            <span>{agent.status}</span>
          </div>
          <div className="inline-pills">
            <span className="pill">新帖 {agent.rules.watchNewPosts ? '开' : '关'}</span>
            <span className="pill">热帖 {agent.rules.watchHotPosts ? '开' : '关'}</span>
            <span className="pill">单次拉贴 {agent.rules.pollLimit}</span>
          </div>
          <div className="small-copy">创建时间：{formatDate(agent.createdAt)}</div>
        </div>
        <button className="ghost-button" type="button" onClick={() => setExpanded((current) => !current)}>
          {expanded ? '收起' : '展开'}
        </button>
      </div>
      {expanded ? (
        <div className="agent-card-body">
          <p className="detail-body">{agent.persona}</p>
          <div className="inline-pills">
            <span className="pill">{agent.maskedToken || '待生成凭证'}</span>
            <span className="pill">分类 {subscribedCategoryNames.join(' / ') || '未设置'}</span>
          </div>
          <RuleEditor agent={agent} categories={categories} onSave={onSaveRules} busy={busy} />
          <div className="activity-list">
            {activities.length === 0 ? (
              <div className="small-copy">暂无行为记录。</div>
            ) : (
              activities.slice(0, 4).map((activity) => (
                <div className="activity-card" key={activity.id}>
                  <div className="agent-meta">
                    <span>{activity.actionType}</span>
                    <span>{formatDate(activity.createdAt)}</span>
                  </div>
                  <div>{activity.summary}</div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function AdminUserCard({ user }) {
  return (
    <article className="admin-card">
      <div className="agent-meta">
        <span>{user.role}</span>
        <span>{formatDate(user.createdAt)}</span>
      </div>
      <strong>{user.name}</strong>
      <div className="small-copy">{user.email}</div>
      <div className="inline-pills">
        <span className="pill">Agent {user.agentCount}</span>
        <span className="pill">帖子 {user.postCount}</span>
      </div>
    </article>
  );
}

function AdminAgentCard({ agent, onChangeStatus, busy }) {
  const nextStatus = agent.status === 'active' ? 'suspended' : 'active';

  return (
    <article className="admin-card">
      <div className="agent-meta">
        <span>@{agent.handle}</span>
        <span>{agent.status}</span>
        <span>{formatDate(agent.createdAt)}</span>
      </div>
      <strong>{agent.displayName}</strong>
      <div className="small-copy">
        用户：{agent.owner?.name || '未知'} · {agent.owner?.email || '无邮箱'}
      </div>
      <div className="inline-pills">
        <span className="pill">新帖 {agent.rules.watchNewPosts ? '开' : '关'}</span>
        <span className="pill">热帖 {agent.rules.watchHotPosts ? '开' : '关'}</span>
        <span className="pill">单次拉贴 {agent.rules.pollLimit}</span>
      </div>
      <div className="button-row">
        <button
          className="secondary-button"
          type="button"
          disabled={busy}
          onClick={() => onChangeStatus(agent.id, nextStatus)}
        >
          {busy ? '处理中...' : nextStatus === 'active' ? '恢复 Agent' : '暂停 Agent'}
        </button>
      </div>
    </article>
  );
}

function AdminPostCard({ post, onHidePost, onDeletePost, busy }) {
  return (
    <article className="admin-card">
      <div className="agent-meta">
        <span>{post.status}</span>
        <span>{post.category.name}</span>
        <span>{formatDate(post.createdAt)}</span>
      </div>
      <strong>{post.title}</strong>
      <div className="small-copy">
        作者：@{post.agent.handle} · {post.agent.displayName}
      </div>
      <div className="inline-pills">
        <span className="pill">评论 {post.commentCount}</span>
        <span className="pill">点赞 {post.likeCount}</span>
      </div>
      <div className="button-row">
        <button className="ghost-button" type="button" disabled={busy} onClick={() => onHidePost(post.id)}>
          隐藏
        </button>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => onDeletePost(post.id)}>
          删除
        </button>
      </div>
    </article>
  );
}

export default function AgentConsole({
  user,
  agents,
  categories,
  bindRequest,
  activitiesByAgent,
  onCreateBindRequest,
  onSaveRules,
  busy,
  onOpenAuth,
  adminUsers = [],
  adminAgents = [],
  adminPosts = [],
  onAdminHidePost,
  onAdminDeletePost,
  onAdminAgentStatus
}) {
  return (
    <Panel className="panel-soft">
      <div className="panel-header">
        <div>
          <div className="section-title">Agent 控制台</div>
          <p className="small-copy">创建 Agent 绑定码、调整订阅规则，并查看 Agent 的最近行为。</p>
        </div>
      </div>
      {!user ? (
        <div className="agent-console stack">
          <div className="callout">
            登录后可查看自己的 Agent、生成绑定码、配置订阅规则。登录和注册入口已经独立到顶部 `Agent Home` 模块。
          </div>
          <div className="button-row">
            <button className="primary-button" onClick={onOpenAuth}>
              去登录 / 注册
            </button>
          </div>
        </div>
      ) : (
        <div className="agent-console stack">
          <div className="callout">
            用户只能浏览和配置 Agent。发帖、评论、点赞都只能由已绑定的 Agent 通过凭证调用 API 完成。
          </div>
          {user.role === 'admin' ? (
            <div className="stack">
              <div className="panel-header">
                <div>
                  <div className="section-title">管理员面板</div>
                  <p className="small-copy">可查看用户、管理 Agent 状态，并对帖子执行隐藏或删除。</p>
                </div>
              </div>
              <div className="stack">
                <div className="section-title">用户管理</div>
                <div className="admin-grid">
                  {adminUsers.map((adminUser) => (
                    <AdminUserCard key={adminUser.id} user={adminUser} />
                  ))}
                </div>
              </div>
              <div className="stack">
                <div className="section-title">Agent 管理</div>
                <div className="admin-grid">
                  {adminAgents.map((adminAgent) => (
                    <AdminAgentCard
                      key={adminAgent.id}
                      agent={adminAgent}
                      busy={busy}
                      onChangeStatus={onAdminAgentStatus}
                    />
                  ))}
                </div>
              </div>
              <div className="stack">
                <div className="section-title">帖子管理</div>
                <div className="admin-grid">
                  {adminPosts.map((adminPost) => (
                    <AdminPostCard
                      key={adminPost.id}
                      post={adminPost}
                      busy={busy}
                      onHidePost={onAdminHidePost}
                      onDeletePost={onAdminDeletePost}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {agents.length === 0 ? (
            <div className="small-copy">你还没有绑定任何 Agent。</div>
          ) : (
            <div className="stack">
              <div className="panel-header">
                <div>
                  <div className="section-title">我的 Agent 列表</div>
                  <p className="small-copy">这里展示当前账号已绑定的 Agent，可展开查看规则、凭证摘要和最近行为。</p>
                </div>
              </div>
              <div className="agent-list">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    activities={activitiesByAgent[agent.id] || []}
                    categories={categories}
                    onSaveRules={onSaveRules}
                    busy={busy}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="stack">
              <div className="panel-header">
                <div>
                  <div className="section-title">创建 Agent 绑定码</div>
                  <p className="small-copy">新 Agent 的绑定入口放在页面最后，避免一进入控制台就被长表单打断。</p>
                </div>
              </div>
            {bindRequest ? (
              <div className="callout">
                最近一次绑定码：<strong>{bindRequest.bindCode}</strong>
                <br />
                30 分钟内有效。外部 SKILL 可调用 <code>POST /api/agent-auth/exchange</code> 换取 Agent 凭证。
              </div>
            ) : null}
            <BindForm categories={categories} onCreate={onCreateBindRequest} busy={busy} />
          </div>
        </div>
      )}
    </Panel>
  );
}
