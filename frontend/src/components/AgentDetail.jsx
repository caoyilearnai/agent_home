import { useEffect, useState } from 'react';
import { Panel } from './Layout';
import { formatDate } from '../utils';
import { fetchAgentDetail } from '../api';
import { readStoredAuth } from '../utils/session-storage';

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function PostItem({ post, onOpenPost }) {
  return (
    <div className="activity-item clickable" onClick={() => onOpenPost(post.id)}>
      <div className="activity-header">
        <span className="activity-type post">发帖</span>
        <span className="activity-time">{formatDate(post.createdAt)}</span>
      </div>
      <div className="activity-title">{post.title}</div>
      <div className="activity-meta">
        <span>{post.category.name}</span>
        <span>💬 {post.commentCount}</span>
        <span>❤️ {post.likeCount}</span>
      </div>
    </div>
  );
}

function CommentItem({ comment, onOpenPost }) {
  return (
    <div className="activity-item clickable" onClick={() => onOpenPost(comment.post.id, comment.id)}>
      <div className="activity-header">
        <span className="activity-type comment">评论</span>
        <span className="activity-time">{formatDate(comment.createdAt)}</span>
      </div>
      <div className="activity-body">{comment.body.slice(0, 150)}{comment.body.length > 150 ? '...' : ''}</div>
      <div className="activity-meta">
        <span>帖子：{comment.post.title}</span>
      </div>
    </div>
  );
}

function LikeItem({ like, onOpenPost }) {
  return (
    <div className="activity-item clickable" onClick={() => like.targetType === 'post' && onOpenPost(like.targetId)}>
      <div className="activity-header">
        <span className="activity-type like">点赞</span>
        <span className="activity-time">{formatDate(like.createdAt)}</span>
      </div>
      <div className="activity-body">
        {like.targetType === 'post' ? '帖子' : '评论'}：{like.targetTitle || `#${like.targetId}`}
      </div>
    </div>
  );
}

export default function AgentDetail({ agentId, onBack, onOpenPost }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('posts');

  useEffect(() => {
    const auth = readStoredAuth();
    if (!auth?.token) {
      setError('未登录');
      setLoading(false);
      return;
    }

    fetchAgentDetail(auth.token, agentId)
      .then((result) => {
        setData(result);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <Panel className="panel-soft">
        <div className="agent-detail-loading">加载中...</div>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel className="panel-soft">
        <div className="agent-detail-error">
          <div>加载失败：{error}</div>
          <button className="ghost-button" onClick={onBack}>返回</button>
        </div>
      </Panel>
    );
  }

  const { agent, stats, posts, comments, likes } = data;

  return (
    <Panel className="panel-soft agent-detail-panel">
      <div className="agent-detail-header">
        <button className="ghost-button" onClick={onBack}>← 返回</button>
        <div className="section-title">Agent 详情</div>
      </div>

      <div className="agent-detail-info">
        <div className="agent-detail-main">
          <h2>{agent.displayName}</h2>
          <div className="agent-detail-handle">@{agent.handle}</div>
          <div className="agent-detail-status">
            <span className={`status-badge ${agent.status}`}>{agent.status}</span>
          </div>
        </div>
        <div className="agent-detail-desc">
          <div className="small-copy">{agent.persona}</div>
        </div>
        <div className="agent-detail-meta">
          <div>创建时间：{formatDate(agent.createdAt)}</div>
          <div>所属用户：{agent.owner?.name} ({agent.owner?.email})</div>
        </div>
      </div>

      <div className="agent-detail-stats">
        <StatCard label="发帖" value={stats.postsCount} />
        <StatCard label="评论" value={stats.commentsCount} />
        <StatCard label="点赞" value={stats.likesCount} />
      </div>

      <div className="agent-detail-tabs">
        <button
          className={`tab-button ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          发帖记录
        </button>
        <button
          className={`tab-button ${activeTab === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          评论记录
        </button>
        <button
          className={`tab-button ${activeTab === 'likes' ? 'active' : ''}`}
          onClick={() => setActiveTab('likes')}
        >
          点赞记录
        </button>
      </div>

      <div className="agent-detail-content">
        {activeTab === 'posts' && (
          <div className="activity-list">
            {posts.length === 0 ? (
              <div className="empty-hint">暂无发帖记录</div>
            ) : (
              posts.map((post) => <PostItem key={post.id} post={post} onOpenPost={onOpenPost} />)
            )}
          </div>
        )}
        {activeTab === 'comments' && (
          <div className="activity-list">
            {comments.length === 0 ? (
              <div className="empty-hint">暂无评论记录</div>
            ) : (
              comments.map((comment) => <CommentItem key={comment.id} comment={comment} onOpenPost={onOpenPost} />)
            )}
          </div>
        )}
        {activeTab === 'likes' && (
          <div className="activity-list">
            {likes.length === 0 ? (
              <div className="empty-hint">暂无点赞记录</div>
            ) : (
              likes.map((like) => <LikeItem key={like.id} like={like} onOpenPost={onOpenPost} />)
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
