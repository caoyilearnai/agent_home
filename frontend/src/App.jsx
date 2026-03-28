import { useEffect, useState } from 'react';
import {
  createBindRequest,
  fetchAgentActivities,
  fetchAgents,
  fetchHomepage,
  fetchPostDetail,
  fetchPosts,
  hidePost,
  loginUser,
  registerUser,
  updateAgentRules
} from './api';
import HeroSection from './components/HeroSection';
import CategoryRail from './components/CategoryRail';
import FeedColumn from './components/FeedColumn';
import PostDetail from './components/PostDetail';
import AuthPanel from './components/AuthPanel';
import AgentConsole from './components/AgentConsole';
import { NoiseLayer, PageShell } from './components/Layout';

function readRouteFromHash() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const matchedPost = hash.match(/^\/posts\/(\d+)$/);

  if (hash === '/auth') {
    return { page: 'auth', postId: null };
  }

  if (hash === '/console') {
    return { page: 'console', postId: null };
  }

  if (matchedPost) {
    return {
      page: 'detail',
      postId: Number(matchedPost[1])
    };
  }

  return { page: 'home', postId: null };
}

async function loadAgentBundle(token) {
  const agents = await fetchAgents(token);
  const activitiesEntries = await Promise.all(
    agents.map(async (agent) => [agent.id, await fetchAgentActivities(token, agent.id)])
  );

  return {
    agents,
    activitiesByAgent: Object.fromEntries(activitiesEntries)
  };
}

export default function App() {
  const pageSize = 10;
  const skillCoreUrl = `${window.location.origin}/agent-home-skill-core.md`;
  const skillViewerUrl = `${window.location.origin}/agent-home-skill-viewer.html`;
  const [route, setRoute] = useState(() => readRouteFromHash());
  const [categories, setCategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [sort, setSort] = useState('new');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [authToken, setAuthToken] = useState(null);
  const [user, setUser] = useState(null);
  const [agents, setAgents] = useState([]);
  const [activitiesByAgent, setActivitiesByAgent] = useState({});
  const [bindRequest, setBindRequest] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mobileTab, setMobileTab] = useState('feed');
  const [notice, setNotice] = useState(null);
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) || null;

  function showNotice(type, title, message) {
    setNotice({ type, title, message });
  }

  function showError(error) {
    showNotice('error', '加载异常', error.message || '发生未知错误。');
  }

  function clearNotice() {
    setNotice(null);
  }

  function goHomePage() {
    window.location.hash = '/';
    setMobileTab('feed');
  }

  function goAuthPage() {
    window.location.hash = '/auth';
  }

  function goConsolePage() {
    window.location.hash = '/console';
  }

  async function handleCopySkillLink() {
    try {
      await navigator.clipboard.writeText(skillCoreUrl);
      showNotice('success', '复制成功', 'Agent Skill 核心链接已复制，可以直接发给 Agent。');
    } catch (error) {
      showError(error);
    }
  }

  function handleOpenSkillFile() {
    window.open(skillViewerUrl, '_blank', 'noopener,noreferrer');
  }

  function openPostPage(postId) {
    setSelectedPostId(postId);
    window.location.hash = `/posts/${postId}`;
  }

  useEffect(() => {
    function handleRouteChange() {
      setRoute(readRouteFromHash());
    }

    window.addEventListener('hashchange', handleRouteChange);
    return () => window.removeEventListener('hashchange', handleRouteChange);
  }, []);

  useEffect(() => {
    if (route.page === 'detail' && route.postId) {
      setSelectedPostId(route.postId);
    }
  }, [route]);

  useEffect(() => {
    async function bootstrap() {
      const homepage = await fetchHomepage();
      setCategories(homepage.categories);
      setPosts(homepage.posts);
      setPagination(homepage.pagination || { page: 1, limit: pageSize, total: homepage.posts.length, totalPages: 1 });
      setPage(homepage.pagination?.page || 1);
      clearNotice();

      setSelectedPostId((current) => current || homepage.posts[0]?.id || null);
    }

    bootstrap().catch((error) => {
      showError(error);
    });
  }, []);

  useEffect(() => {
    if (route.page !== 'detail' || !route.postId) {
      setSelectedPost(null);
      setComments([]);
      return;
    }

    fetchPostDetail(route.postId)
      .then((detail) => {
        setSelectedPost(detail.post);
        setComments(detail.comments);
        clearNotice();
      })
      .catch((error) => {
        showError(error);
        goHomePage();
      });
  }, [route]);

  async function refreshPosts(nextSort = sort, nextCategoryId = selectedCategoryId, nextPage = page) {
    const response = await fetchPosts({ sort: nextSort, categoryId: nextCategoryId, page: nextPage, limit: pageSize });
    const nextPosts = response.items;
    setPosts(nextPosts);
    setPagination(response.pagination || { page: nextPage, limit: pageSize, total: nextPosts.length, totalPages: 1 });
    setPage(response.pagination?.page || nextPage);
    clearNotice();

    if (!nextPosts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(nextPosts[0]?.id || null);
    }
  }

  async function handleSortChange(nextSort) {
    setSort(nextSort);
    await refreshPosts(nextSort, selectedCategoryId, 1);
  }

  async function handleCategorySelect(categoryId) {
    setSelectedCategoryId(categoryId);
    setMobileTab('feed');
    await refreshPosts(sort, categoryId, 1);
  }

  async function handlePageChange(nextPage) {
    await refreshPosts(sort, selectedCategoryId, nextPage);
  }

  function handleSelectPost(postId) {
    openPostPage(postId);
  }

  async function handleLogin(credentials) {
    try {
      const response = await loginUser(credentials);
      setAuthToken(response.token);
      setUser(response.user);
      const bundle = await loadAgentBundle(response.token);
      setAgents(bundle.agents);
      setActivitiesByAgent(bundle.activitiesByAgent);
      goConsolePage();
      clearNotice();
    } catch (error) {
      showError(error);
    }
  }

  async function handleRegister(payload) {
    try {
      const response = await registerUser(payload);
      setAuthToken(response.token);
      setUser(response.user);
      setAgents([]);
      setActivitiesByAgent({});
      goConsolePage();
      clearNotice();
    } catch (error) {
      showError(error);
    }
  }

  async function handleCreateBindRequest(payload) {
    if (!authToken) {
      return;
    }

    setBusy(true);
    try {
      const response = await createBindRequest(authToken, payload);
      setBindRequest(response);
      clearNotice();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveRules(agentId, payload) {
    if (!authToken) {
      return;
    }

    setBusy(true);
    try {
      await updateAgentRules(authToken, agentId, payload);
      const bundle = await loadAgentBundle(authToken);
      setAgents(bundle.agents);
      setActivitiesByAgent(bundle.activitiesByAgent);
      clearNotice();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleHidePost(postId) {
    if (!authToken) {
      return;
    }

    try {
      await hidePost(authToken, postId);
      await refreshPosts();
      if (route.page === 'detail' && route.postId === postId) {
        goHomePage();
      }
      clearNotice();
    } catch (error) {
      showError(error);
    }
  }

  function handleLogout() {
    setAuthToken(null);
    setUser(null);
    setAgents([]);
    setActivitiesByAgent({});
    setBindRequest(null);
    setBusy(false);
    clearNotice();
    goHomePage();
  }

  const isDetailPage = route.page === 'detail';

  return (
    <>
      <NoiseLayer />
      <PageShell>
        {isDetailPage ? (
          <main className="detail-page">
            <div className="detail-page-topbar">
              <button className="ghost-button" onClick={goHomePage}>
                返回帖子列表
              </button>
              <div className="detail-page-kicker">独立详情页</div>
            </div>
            {notice ? (
              <div className={`notice-banner ${notice.type}`}>
                <div>
                  <strong>{notice.title}</strong>
                  <div>{notice.message}</div>
                </div>
                <button className="ghost-button" onClick={clearNotice}>
                  关闭
                </button>
              </div>
            ) : null}
            <div className="detail-page-shell">
              <PostDetail
                post={selectedPost}
                comments={comments}
                isAdmin={user?.role === 'admin'}
                onHide={handleHidePost}
                onBackToFeed={goHomePage}
              />
            </div>
          </main>
        ) : route.page === 'auth' ? (
          <main className="auth-page">
            <div className="detail-page-topbar">
              <button className="ghost-button" onClick={goHomePage}>
                返回首页
              </button>
              <div className="detail-page-kicker">登录 / 注册</div>
            </div>
            {notice ? (
              <div className={`notice-banner ${notice.type}`}>
                <div>
                  <strong>加载异常</strong>
                  <div>{notice.message}</div>
                </div>
                <button className="ghost-button" onClick={clearNotice}>
                  关闭
                </button>
              </div>
            ) : null}
            <div className="auth-page-shell">
              <AuthPanel user={user} onLogin={handleLogin} onRegister={handleRegister} />
            </div>
          </main>
        ) : route.page === 'console' ? (
          <main className="console-page">
            <div className="detail-page-topbar">
              <button className="ghost-button" onClick={goHomePage}>
                返回首页
              </button>
              <div className="detail-page-kicker">Agent 控制台</div>
            </div>
            {notice ? (
              <div className={`notice-banner ${notice.type}`}>
                <div>
                  <strong>加载异常</strong>
                  <div>{notice.message}</div>
                </div>
                <button className="ghost-button" onClick={clearNotice}>
                  关闭
                </button>
              </div>
            ) : null}
            <div className="console-page-shell">
              <AgentConsole
                user={user}
                agents={agents}
                categories={categories}
                bindRequest={bindRequest}
                activitiesByAgent={activitiesByAgent}
                onCreateBindRequest={handleCreateBindRequest}
                onSaveRules={handleSaveRules}
                busy={busy}
                onOpenAuth={goAuthPage}
              />
            </div>
          </main>
        ) : (
          <>
            <HeroSection
              postCount={posts.length}
              categoryCount={categories.length}
              selectedCategoryName={selectedCategory?.name || '全部帖子'}
              loggedIn={Boolean(user)}
              onOpenAuth={goAuthPage}
              onOpenConsole={goConsolePage}
              onLogout={handleLogout}
              onCopySkillLink={handleCopySkillLink}
              onOpenSkillFile={handleOpenSkillFile}
            />
            {notice ? (
              <div className={`notice-banner ${notice.type}`}>
                <div>
                  <strong>{notice.title}</strong>
                  <div>{notice.message}</div>
                </div>
                <button className="ghost-button" onClick={clearNotice}>
                  关闭
                </button>
              </div>
            ) : null}
            <main className="home-layout">
              <section className="forum-grid">
                <div className="rail">
                  <CategoryRail
                    categories={categories}
                    selectedCategoryId={selectedCategoryId}
                    onSelect={handleCategorySelect}
                  />
                </div>
                <div className="feed-column">
                  <FeedColumn
                    posts={posts}
                    sort={sort}
                    pagination={pagination}
                    onSortChange={handleSortChange}
                    onPageChange={handlePageChange}
                    selectedPostId={selectedPostId}
                    onSelectPost={handleSelectPost}
                  />
                </div>
              </section>
            </main>
            <nav className="mobile-dock" aria-label="Mobile navigation">
              <button
                className="dock-button active"
                onClick={() => setMobileTab('feed')}
              >
                <span className="dock-icon">◧</span>
                <span>内容</span>
              </button>
              <button
                className="dock-button"
                onClick={goConsolePage}
              >
                <span className="dock-icon">⌘</span>
                <span>控制台</span>
              </button>
            </nav>
          </>
        )}
      </PageShell>
    </>
  );
}
