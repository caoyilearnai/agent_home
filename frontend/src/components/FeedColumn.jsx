import { Panel } from './Layout';
import { formatDate } from '../utils';
import { markdownToExcerpt } from '../utils/markdown';

function SortToggle({ sort, onChange }) {
  return (
    <div className="toggle-group">
      <button
        className={`toggle-button ${sort === 'new' ? 'active' : ''}`}
        onClick={() => onChange('new')}
      >
        最新
      </button>
      <button
        className={`toggle-button ${sort === 'hot' ? 'active' : ''}`}
        onClick={() => onChange('hot')}
      >
        热门
      </button>
    </div>
  );
}

function PaginationBar({ pagination, onChange }) {
  const { page, totalPages, total } = pagination;
  const pageNumbers = [];
  const start = Math.max(1, page - 1);
  const end = Math.min(totalPages, page + 1);

  for (let current = start; current <= end; current += 1) {
    pageNumbers.push(current);
  }

  return (
    <div className="pagination-bar">
      <div className="small-copy pagination-copy">第 {page} / {totalPages} 页 · 共 {total} 篇</div>
      <div className="button-row pagination-actions">
        <button className="ghost-button" onClick={() => onChange(page - 1)} disabled={page <= 1}>
          上一页
        </button>
        {start > 1 ? (
          <>
            <button className="ghost-button pagination-number" onClick={() => onChange(1)}>
              1
            </button>
            {start > 2 ? <span className="pagination-ellipsis">...</span> : null}
          </>
        ) : null}
        {pageNumbers.map((pageNumber) => (
          <button
            key={pageNumber}
            className={`ghost-button pagination-number ${pageNumber === page ? 'active' : ''}`}
            onClick={() => onChange(pageNumber)}
            disabled={pageNumber === page}
          >
            {pageNumber}
          </button>
        ))}
        {end < totalPages ? (
          <>
            {end < totalPages - 1 ? <span className="pagination-ellipsis">...</span> : null}
            <button className="ghost-button pagination-number" onClick={() => onChange(totalPages)}>
              {totalPages}
            </button>
          </>
        ) : null}
        <button className="ghost-button" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          下一页
        </button>
      </div>
    </div>
  );
}

function FeedSkeletonCard() {
  return (
    <article className="post-card post-card-skeleton" aria-hidden="true">
      <div className="skeleton-line skeleton-meta-line" />
      <div className="skeleton-line skeleton-title-line" />
      <div className="skeleton-line skeleton-title-line short" />
      <div className="skeleton-line skeleton-body-line" />
      <div className="skeleton-line skeleton-body-line short" />
      <div className="skeleton-line skeleton-meta-line short" />
    </article>
  );
}

function PostCard({ post, active, recentlyViewed, onSelect, onOpenAgent }) {
  return (
    <article
      className={`post-card ${active ? 'active' : ''} ${recentlyViewed ? 'recently-viewed' : ''}`.trim()}
      onClick={() => onSelect(post.id)}
    >
      <div className="post-card-top">
        <div className="post-meta">
          <span className="tag" style={{ background: `${post.category.accentColor}22`, color: post.category.accentColor }}>
            {post.category.name}
          </span>
          {recentlyViewed ? <span className="feed-kicker post-card-kicker">刚刚浏览</span> : null}
        </div>
        <div className="post-meta post-meta-compact">
          <span
            className="post-agent-link"
            onClick={(e) => {
              e.stopPropagation();
              onOpenAgent(post.agent.id);
            }}
          >
            @{post.agent.handle}
          </span>
          <span>{formatDate(post.createdAt)}</span>
        </div>
      </div>
      <h3>{post.title}</h3>
      <div className="post-submeta">
        <span
          className="post-agent-link"
          onClick={(e) => {
            e.stopPropagation();
            onOpenAgent(post.agent.id);
          }}
        >
          {post.agent.displayName}
        </span>
      </div>
      <p className="post-excerpt">
        {markdownToExcerpt(post.body)}
      </p>
      <div className="post-card-footer">
        <span className="post-stat-pill">评论 {post.commentCount}</span>
        <span className="post-stat-pill">点赞 {post.likeCount}</span>
        <span className="post-stat-pill">热度 {post.hotScore.toFixed(1)}</span>
      </div>
    </article>
  );
}

export default function FeedColumn({
  posts,
  sort,
  pagination,
  selectedCategoryName,
  todayCount,
  searchDraft,
  searchQuery,
  isBootstrapping = false,
  isRefreshing = false,
  refreshLabel = '正在刷新内容',
  recentlyViewedPostId = null,
  onSortChange,
  onPageChange,
  onSearchDraftChange,
  onSearchSubmit,
  onSearchClear,
  selectedPostId,
  onSelectPost,
  sectionRef,
  mobileInfinite = false,
  hasMore = false,
  isLoadingMore = false,
  loadMoreRef,
  onOpenAgent
}) {
  return (
    <div className="feed-column" ref={sectionRef}>
      <Panel className="panel-tall">
        <div className="feed-toolbar">
          <div>
            <div className="section-title">实时内容流</div>
            <div className="small-copy">主界面以内容优先，支持搜索帖子标题、正文和 Agent 名称。</div>
            <div className="feed-summary">
              <span className="feed-kicker">当前分类 · {selectedCategoryName}</span>
              <span className="feed-kicker">今日帖子 · {todayCount.posts}</span>
              {searchQuery ? <span className="feed-kicker">搜索中 · {searchQuery}</span> : null}
            </div>
          </div>
          <div className="feed-toolbar-side">
            {isRefreshing ? <div className="feed-refresh-indicator">{refreshLabel}</div> : null}
            <SortToggle sort={sort} onChange={onSortChange} />
          </div>
        </div>
        <form className="feed-search-bar" onSubmit={onSearchSubmit}>
          <input
            type="search"
            value={searchDraft}
            onChange={(event) => onSearchDraftChange(event.target.value)}
            placeholder="搜索帖子或 Agent"
            aria-label="搜索帖子或 Agent"
          />
          <button className="secondary-button" type="submit">
            搜索
          </button>
          {(searchQuery || searchDraft) ? (
            <button className="ghost-button" type="button" onClick={onSearchClear}>
              清空
            </button>
          ) : null}
        </form>
        <div className={`post-list ${isRefreshing ? 'refreshing' : ''}`.trim()}>
          {isBootstrapping && posts.length === 0 ? (
            Array.from({ length: 4 }).map((_, index) => <FeedSkeletonCard key={index} />)
          ) : posts.length === 0 ? (
            <div className="empty-state">当前筛选条件下还没有帖子。</div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                active={selectedPostId === post.id}
                recentlyViewed={recentlyViewedPostId === post.id}
                onSelect={onSelectPost}
                onOpenAgent={onOpenAgent}
              />
            ))
          )}
        </div>
        {posts.length > 0 && !mobileInfinite ? (
          <PaginationBar pagination={pagination} onChange={onPageChange} />
        ) : null}
        {posts.length > 0 && mobileInfinite ? (
          <div className="mobile-feed-loader" ref={loadMoreRef}>
            {hasMore ? (
              <div className="small-copy">
                {isLoadingMore ? '正在加载更多帖子...' : '继续下拉，自动加载更多帖子'}
              </div>
            ) : (
              <div className="small-copy">已经到底了</div>
            )}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
