import { useEffect, useState } from 'react';
import { Panel } from './Layout';
import { formatDate } from '../utils';
import MarkdownContent from './MarkdownContent';
import { generatePostShareCard } from '../utils/share-card';
import { exportBlobFile, isNativeApp } from '../utils/app-shell';

function buildShareFilename(post) {
  return `agent-home-post-${post.id}-share.png`;
}

function revokeObjectUrl(value) {
  if (value?.startsWith('blob:')) {
    URL.revokeObjectURL(value);
  }
}

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
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isGeneratingShareImage, setIsGeneratingShareImage] = useState(false);
  const [shareImageBlob, setShareImageBlob] = useState(null);
  const [shareImageUrl, setShareImageUrl] = useState('');
  const [shareTargetUrl, setShareTargetUrl] = useState('');
  const [shareError, setShareError] = useState('');
  const [sharePostId, setSharePostId] = useState(null);
  const shareActionLabel = isNativeApp() ? '保存 / 分享图片' : '下载图片';

  useEffect(() => {
    if (scrollToCommentId) {
      const el = document.getElementById(`comment-${scrollToCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        onScrollComplete?.();
      }
    }
  }, [scrollToCommentId, comments, onScrollComplete]);

  useEffect(() => {
    revokeObjectUrl(shareImageUrl);
    setIsShareOpen(false);
    setIsGeneratingShareImage(false);
    setShareImageBlob(null);
    setShareImageUrl('');
    setShareTargetUrl('');
    setShareError('');
    setSharePostId(null);
  }, [post?.id]);

  useEffect(() => () => {
    revokeObjectUrl(shareImageUrl);
  }, [shareImageUrl]);

  useEffect(() => {
    if (!isShareOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsShareOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isShareOpen]);

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

  async function handleOpenShareSheet() {
    if (!post) {
      return;
    }

    setIsShareOpen(true);
    if (sharePostId === post.id && shareImageUrl) {
      return;
    }

    setIsGeneratingShareImage(true);
    setShareError('');

    try {
      const result = await generatePostShareCard(post);
      revokeObjectUrl(shareImageUrl);
      setShareImageBlob(result.imageBlob);
      setShareImageUrl(result.objectUrl);
      setShareTargetUrl(result.shareUrl);
      setSharePostId(post.id);
    } catch (error) {
      setShareError(error.message || '分享图生成失败。');
    } finally {
      setIsGeneratingShareImage(false);
    }
  }

  function handleCloseShareSheet() {
    setIsShareOpen(false);
  }

  async function handleDownloadShareImage() {
    if (!post || !shareImageBlob) {
      return;
    }

    try {
      await exportBlobFile({
        blob: shareImageBlob,
        fileName: buildShareFilename(post),
        title: `${post.title} 分享图`,
        text: shareTargetUrl
      });
    } catch (error) {
      setShareError(error.message || '分享图导出失败。');
    }
  }

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
              <div className="agent-actions detail-header-actions">
                <button className="secondary-button" onClick={handleOpenShareSheet}>
                  微信分享
                </button>
                {isAdmin ? (
                  <button className="secondary-button" onClick={() => onHide(post.id)}>
                    隐藏帖子
                  </button>
                ) : null}
              </div>
            </div>
            <div className="terminal-body">
              <h1 className="detail-title">{post.title}</h1>
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
      {isShareOpen ? (
        <div
          className="share-sheet-backdrop"
          onClick={handleCloseShareSheet}
          role="presentation"
        >
          <div
            className="share-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="帖子微信分享图"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="share-sheet-head">
              <div>
                <div className="section-title">微信分享图</div>
                <div className="small-copy">生成一张可转发到微信的图片，包含标题和帖子详情二维码。</div>
              </div>
              <button className="ghost-button" onClick={handleCloseShareSheet}>
                关闭
              </button>
            </div>
            <div className="share-sheet-body">
              {isGeneratingShareImage ? (
                <div className="share-sheet-placeholder">
                  <strong>正在生成分享图</strong>
                  <span>二维码和图片会在本地浏览器内生成，不会经过后端。</span>
                </div>
              ) : shareError ? (
                <div className="share-sheet-placeholder share-sheet-error">
                  <strong>生成失败</strong>
                  <span>{shareError}</span>
                </div>
              ) : (
                <img className="share-sheet-image" src={shareImageUrl} alt={`${post.title} 微信分享图`} />
              )}
            </div>
            <div className="share-sheet-footer">
              <div className="share-sheet-meta">
                <div className="small-copy">二维码链接</div>
                <div className="share-sheet-url">{shareTargetUrl}</div>
                <div className="small-copy">在微信里可直接发送这张图片，接收方扫码后会打开帖子详情。</div>
              </div>
              <div className="agent-actions share-sheet-actions">
                <button className="ghost-button" onClick={handleCloseShareSheet}>
                  取消
                </button>
                <button className="primary-button" onClick={handleDownloadShareImage} disabled={!shareImageUrl}>
                  {shareActionLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
