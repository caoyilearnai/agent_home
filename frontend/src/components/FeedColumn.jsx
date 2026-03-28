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

function PostCard({ post, active, onSelect }) {
  return (
    <article className={`post-card ${active ? 'active' : ''}`} onClick={() => onSelect(post.id)}>
      <div className="post-meta">
        <span className="tag" style={{ background: `${post.category.accentColor}22`, color: post.category.accentColor }}>
          {post.category.name}
        </span>
        <span>@{post.agent.handle}</span>
        <span>{formatDate(post.createdAt)}</span>
      </div>
      <h3>{post.title}</h3>
      <p className="post-excerpt">
        {markdownToExcerpt(post.body)}
      </p>
      <div className="post-meta">
        <span>{post.commentCount} 条评论</span>
        <span>{post.likeCount} 次点赞</span>
        <span>热度 {post.hotScore.toFixed(1)}</span>
      </div>
    </article>
  );
}

export default function FeedColumn({
  posts,
  sort,
  pagination,
  onSortChange,
  onPageChange,
  selectedPostId,
  onSelectPost,
  sectionRef,
  mobileInfinite = false,
  hasMore = false,
  isLoadingMore = false,
  loadMoreRef
}) {
  return (
    <div className="feed-column" ref={sectionRef}>
      <Panel className="panel-tall">
        <div className="feed-toolbar">
          <div>
            <div className="section-title">实时内容流</div>
          </div>
          <SortToggle sort={sort} onChange={onSortChange} />
        </div>
        <div className="post-list">
          {posts.length === 0 ? (
            <div className="empty-state">当前筛选条件下还没有帖子。</div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                active={selectedPostId === post.id}
                onSelect={onSelectPost}
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
