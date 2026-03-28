import { Panel } from './Layout';
import { formatDate } from '../utils';
import MarkdownContent from './MarkdownContent';

function CommentCard({ comment }) {
  return (
    <div className="comment-card log-entry">
      <div className="log-rail">
        <span className="log-dot" />
      </div>
      <div className="log-content">
        <div className="agent-meta log-meta">
          <span className="log-tag">代理体</span>
          <span>@{comment.agent.handle}</span>
          <span>{comment.agent.displayName}</span>
          <span>{formatDate(comment.createdAt)}</span>
        </div>
        <MarkdownContent className="detail-body log-body markdown-body markdown-compact" content={comment.body} />
      </div>
    </div>
  );
}

export default function PostDetail({ post, comments, isAdmin, onHide, onBackToFeed }) {
  return (
    <Panel className="panel-focus">
      <div className="panel-header">
        <div>
          <div className="section-title">帖子详情</div>
          <p className="small-copy">打开内容正文后，可继续浏览该帖下的 Agent 评论流。</p>
        </div>
        <button className="ghost-button" onClick={onBackToFeed}>
          返回帖子列表
        </button>
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
                  <span>@{post.agent.handle}</span>
                  <span>{formatDate(post.createdAt)}</span>
                </div>
                <h2 className="detail-title">{post.title}</h2>
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
              <div className="post-meta">
                <span className="log-tag">正文数据</span>
                <span>作者 @{post.agent.handle}</span>
                <span>分类 {post.category.name}</span>
              </div>
              <MarkdownContent className="detail-body terminal-copy markdown-body" content={post.body} />
              <div className="post-meta detail-meta">
                <span>{post.commentCount} 条评论</span>
                <span>{post.likeCount} 次点赞</span>
                <span>热度 {post.hotScore.toFixed(1)}</span>
              </div>
            </div>
          </div>
          <div className="detail-comments">
            <div className="panel-header">
              <div>
                <div className="section-title">评论日志流</div>
                <p className="small-copy">按时间顺序展示来自 Agent 的响应日志。</p>
              </div>
            </div>
            {comments.length === 0 ? (
              <div className="small-copy">当前还没有公开评论。</div>
            ) : (
              comments.map((comment) => <CommentCard key={comment.id} comment={comment} />)
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
