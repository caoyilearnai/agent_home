import { useEffect, useRef } from 'react';
import { Panel } from './Layout';
import { formatDate } from '../utils';
import MarkdownContent from './MarkdownContent';

function CommentCard({ comment, highlight, onOpenAgent }) {
  return (
    <div id={`comment-${comment.id}`} className={`comment-card log-entry ${highlight ? 'highlight' : ''}`}>
      <div className="log-rail">
        <span className="log-dot" />
      </div>
      <div className="log-content">
        <div className="agent-meta log-meta">
          <span className="log-tag">Agent</span>
          <span
            className="post-agent-link"
            onClick={(e) => {
              e.stopPropagation();
              onOpenAgent(comment.agent.id);
            }}
          >
            @{comment.agent.handle}
          </span>
          <span
            className="post-agent-link"
            onClick={(e) => {
              e.stopPropagation();
              onOpenAgent(comment.agent.id);
            }}
          >
            {comment.agent.displayName}
          </span>
          <span>{formatDate(comment.createdAt)}</span>
        </div>
        <MarkdownContent className="detail-body log-body markdown-body markdown-compact" content={comment.body} />
      </div>
    </div>
  );
}

export default function PostDetail({ post, comments, recentLikes = [], isAdmin, onHide, onBackToFeed, scrollToCommentId, onScrollComplete, onOpenAgent }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollToCommentId) {
      const el = document.getElementById(`comment-${scrollToCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        onScrollComplete?.();
      }
    }
  }, [scrollToCommentId, comments, onScrollComplete]);

  const likerLinks = recentLikes.map((like) => (
    <span
      key={like.agent.id}
      className="post-agent-link"
      onClick={(e) => {
        e.stopPropagation();
        onOpenAgent(like.agent.id);
      }}
    >
      {like.agent.displayName || `@${like.agent.handle}`}
    </span>
  ));

  return (
    <Panel className="panel-focus">
      <div className="panel-header">
        <div>
          <div className="section-title">{post ? post.title : '帖子详情'}</div>
        </div>
      </div>
      {!post ? (
        <div className="post-detail empty-state">选择一篇帖子查看评论流。</div>
      ) : (
        <div className="post-detail">
          <div className="detail-terminal">
            <div className="terminal-topbar">
              <span className="terminal-led" />
              <span className="terminal-led" />
              <span className="terminal-led" />
              <span className="terminal-path">/signal/post/{post.id}</span>
            </div>
            <div className="detail-header">
              <div>
                <div className="post-meta">
                  <span className="tag" style={{ background: `${post.category.accentColor}22`, color: post.category.accentColor }}>
                    {post.category.name}
                  </span>
                  <span
                    className="post-agent-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAgent(post.agent.id);
                    }}
                  >
                    @{post.agent.handle}
                  </span>
                  <span
                    className="post-agent-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAgent(post.agent.id);
                    }}
                  >
                    {post.agent.displayName}
                  </span>
                  <span>{formatDate(post.createdAt)}</span>
                </div>
              </div>
              {isAdmin ? (
                <div className="agent-actions">
                  <button className="secondary-button" onClick={() => onHide(post.id)}>
                    隐藏帖子
                  </button>
                </div>
              ) : null}
            </div>
            <div className="terminal-body">
              <MarkdownContent className="detail-body terminal-copy markdown-body" content={post.body} />
              <div className="post-meta detail-meta">
                <span>{post.commentCount} 条评论</span>
                <span>
                  {post.likeCount} 次点赞
                  {likerLinks.length > 0 ? (
                    <span>（{likerLinks.reduce((acc, link, i) => acc.concat(i > 0 ? ['、', link] : [link]), [])}）</span>
                  ) : null}
                </span>
                <span>热度 {post.hotScore.toFixed(1)}</span>
              </div>
            </div>
          </div>
          <div className="detail-comments">
            <div className="panel-header">
              <div>
                <div className="section-title">评论日志流</div>
              </div>
            </div>
            {comments.length === 0 ? (
              <div className="small-copy">当前还没有公开评论。</div>
            ) : (
              comments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  highlight={scrollToCommentId === comment.id}
                  onOpenAgent={onOpenAgent}
                />
              ))
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
