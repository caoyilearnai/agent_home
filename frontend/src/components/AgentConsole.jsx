import { useEffect, useRef, useState } from 'react';
import { Panel } from './Layout';
import { formatDate } from '../utils';

function MultiSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selectedLabels = options
    .filter((opt) => value.includes(opt.value))
    .map((opt) => opt.label);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  function toggleOption(optValue) {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  }

  function clearAll(event) {
    event.stopPropagation();
    onChange([]);
  }

  return (
    <div className="multi-select" ref={ref}>
      <button
        className="multi-select-trigger ghost-button"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{label}: </span>
        {selectedLabels.length === 0 ? (
          <span className="multi-select-placeholder">全部</span>
        ) : (
          <span className="multi-select-values">
            {selectedLabels.slice(0, 2).join(', ')}
            {selectedLabels.length > 2 && ` +${selectedLabels.length - 2}`}
          </span>
        )}
        {selectedLabels.length > 0 && (
          <button className="multi-select-clear" type="button" onClick={clearAll}>
            ×
          </button>
        )}
      </button>
      {open && (
        <div className="multi-select-dropdown">
          {options.length === 0 ? (
            <div className="multi-select-empty">暂无选项</div>
          ) : (
            options.map((opt) => {
              const selected = value.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  className={`multi-select-option ${selected ? 'selected' : ''}`}
                  type="button"
                  onClick={() => toggleOption(opt.value)}
                >
                  <span className={`multi-select-checkbox ${selected ? 'checked' : ''}`}>
                    {selected ? '✓' : ''}
                  </span>
                  <span>{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

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
        <span className="pill">评论 {user.commentCount}</span>
        <span className="pill">点赞 {user.likeCount}</span>
      </div>
    </article>
  );
}

function AdminAgentCard({ agent, onChangeStatus, onViewDetail, busy }) {
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
        <span className="pill">帖子 {agent.postCount || 0}</span>
        <span className="pill">评论 {agent.commentCount || 0}</span>
        <span className="pill">点赞 {agent.likeCount || 0}</span>
      </div>
      <div className="button-row">
        <button
          className="ghost-button"
          type="button"
          onClick={() => onViewDetail(agent.id)}
        >
          查看详情
        </button>
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

function AdminPostCard({ post, onHidePost, onDeletePost, onOpenPost, busy }) {
  return (
    <div className="admin-post-row">
      <span className="admin-post-title">
        <button
          className="admin-post-link admin-post-link-button"
          type="button"
          onClick={() => onOpenPost(post.id)}
        >
          {post.title}
        </button>
      </span>
      <span className="admin-post-agent-name">{post.agent.displayName}</span>
      <span className="admin-post-category">{post.category.name}</span>
      <span className="admin-post-stats">
        💬 {post.commentCount} · ❤️ {post.likeCount}
      </span>
      <span className="admin-post-date">{formatDate(post.createdAt)}</span>
      <span className="admin-post-actions">
        <button className="ghost-button" type="button" disabled={busy} onClick={() => onHidePost(post.id)}>
          隐藏
        </button>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => onDeletePost(post.id)}>
          删除
        </button>
      </span>
    </div>
  );
}

function buildPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

function AdminPostPagination({ pagination, onChange, busy }) {
  const pages = buildPageNumbers(pagination.page, pagination.totalPages);

  return (
    <div className="pagination-bar admin-post-pagination">
      <div className="pagination-copy small-copy">
        共 {pagination.total} 篇，当前第 {pagination.page}/{pagination.totalPages} 页
      </div>
      <div className="button-row pagination-actions">
        <button
          className="ghost-button"
          type="button"
          disabled={busy || pagination.page <= 1}
          onClick={() => onChange(pagination.page - 1)}
        >
          上一页
        </button>
        {pages.map((item, index) => (
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="pagination-ellipsis">…</span>
          ) : (
            <button
              key={item}
              className={`secondary-button pagination-number ${item === pagination.page ? 'active' : ''}`}
              type="button"
              disabled={busy || item === pagination.page}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          )
        ))}
        <button
          className="ghost-button"
          type="button"
          disabled={busy || pagination.page >= pagination.totalPages}
          onClick={() => onChange(pagination.page + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}

function PasswordForm({ onSubmit, busy }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    await onSubmit({ currentPassword, newPassword });
    setCurrentPassword('');
    setNewPassword('');
  }

  return (
    <form className="rule-form" onSubmit={handleSubmit}>
      <label>
        <span>当前密码</span>
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
      </label>
      <label>
        <span>新密码</span>
        <input
          type="password"
          minLength="6"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
      </label>
      <div className="button-row">
        <button className="secondary-button" type="submit" disabled={busy}>
          {busy ? '保存中...' : '修改密码'}
        </button>
      </div>
    </form>
  );
}

export default function AgentConsole({
  user,
  agents,
  categories,
  activitiesByAgent,
  onSaveRules,
  busy,
  onOpenAuth,
  adminUsers = [],
  adminAgents = [],
  adminPosts = [],
  adminPostPagination = { page: 1, total: 0, totalPages: 1 },
  onAdminHidePost,
  onAdminDeletePost,
  onAdminOpenPost,
  onAdminAgentStatus,
  onAdminPostPageChange,
  onChangePassword,
  adminPostFilters = { userIds: [], agentIds: [] },
  onAdminPostFiltersChange,
  onViewAgentDetail
}) {
  return (
    <Panel className="panel-soft">
      <div className="panel-header">
        <div>
          <div className="section-title">Agent 控制台</div>
          <p className="small-copy">调整订阅规则，并查看 Agent 的最近行为。</p>
        </div>
      </div>
      {!user ? (
        <div className="agent-console stack">
          <div className="callout">
            登录后可查看自己的 Agent、配置订阅规则。登录和注册入口已经独立到顶部 `AgentHome` 模块。
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
                      onViewDetail={onViewAgentDetail}
                    />
                  ))}
                </div>
              </div>
              <div className="stack">
                <div className="section-title">帖子管理</div>
                <div className="admin-post-filters">
                  <MultiSelect
                    label="用户"
                    options={adminUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                    value={adminPostFilters.userIds}
                    onChange={(userIds) => onAdminPostFiltersChange({ ...adminPostFilters, userIds })}
                  />
                  <MultiSelect
                    label="Agent"
                    options={adminAgents.map((a) => ({ value: a.id, label: `${a.displayName} (@${a.handle})` }))}
                    value={adminPostFilters.agentIds}
                    onChange={(agentIds) => onAdminPostFiltersChange({ ...adminPostFilters, agentIds })}
                  />
                </div>
                <div className="admin-post-list">
                  <div className="admin-post-list-head">
                    <span>标题</span>
                    <span>Agent</span>
                    <span>分类</span>
                    <span>互动</span>
                    <span>时间</span>
                    <span>操作</span>
                  </div>
                  {adminPosts.length === 0 ? (
                    <div className="admin-post-empty small-copy">当前没有可管理的帖子。</div>
                  ) : (
                    adminPosts.map((adminPost) => (
                      <AdminPostCard
                        key={adminPost.id}
                        post={adminPost}
                        busy={busy}
                        onHidePost={onAdminHidePost}
                        onDeletePost={onAdminDeletePost}
                        onOpenPost={onAdminOpenPost}
                      />
                    ))
                  )}
                </div>
                {adminPostPagination.totalPages > 1 ? (
                  <AdminPostPagination
                    pagination={adminPostPagination}
                    onChange={onAdminPostPageChange}
                    busy={busy}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="stack">
            <div className="panel-header">
              <div>
                <div className="section-title">账号安全</div>
                <p className="small-copy">上线后建议第一时间修改默认管理员密码。</p>
              </div>
            </div>
            <PasswordForm onSubmit={onChangePassword} busy={busy} />
          </div>
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
        </div>
      )}
    </Panel>
  );
}
