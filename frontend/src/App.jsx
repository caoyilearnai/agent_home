import { useEffect, useRef, useState } from 'react';
import {
  activateAdminAgent,
  changePassword,
  deletePostAsAdmin,
  fetchAdminAgents,
  fetchAdminPosts,
  fetchAdminUsers,
  fetchAgentActivities,
  fetchAgents,
  fetchHomepage,
  fetchPostDetail,
  fetchPosts,
  hidePost,
  loginUser,
  registerUser,
  suspendAdminAgent,
  updateAgentRules
} from './api';
import HeroSection from './components/HeroSection';
import CategoryRail from './components/CategoryRail';
import FeedColumn from './components/FeedColumn';
import PostDetail from './components/PostDetail';
import AuthPanel from './components/AuthPanel';
import AgentConsole from './components/AgentConsole';
import AgentDetail from './components/AgentDetail';
import { NoiseLayer, PageShell } from './components/Layout';

const AUTH_STORAGE_KEY = 'agent-home-auth';
const AUTH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const THEME_STORAGE_KEY = 'agent-home-theme';
const DEFAULT_THEME = 'tech';

function normalizeRoutePath(routePath) {
  if (routePath === '/index.html') {
    return '/';
  }

  if (routePath.length > 1 && routePath.endsWith('/')) {
    return routePath.slice(0, -1);
  }

  return routePath || '/';
}

function parseRoutePath(routePath) {
  const normalizedPath = normalizeRoutePath(routePath);
  const matchedPost = normalizedPath.match(/^\/posts\/(\d+)$/);

  if (normalizedPath === '/auth') {
    return { page: 'auth', postId: null };
  }

  if (normalizedPath === '/console') {
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

function readRouteFromLocation() {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.startsWith('/')) {
    return parseRoutePath(hash);
  }

  return parseRoutePath(window.location.pathname);
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

async function loadAdminBundle(token, postPage = 1, postLimit = 10, postFilters = { userIds: [], agentIds: [] }) {
  const [users, agents, posts] = await Promise.all([
    fetchAdminUsers(token),
    fetchAdminAgents(token),
    fetchAdminPosts(token, { page: postPage, limit: postLimit, userIds: postFilters.userIds, agentIds: postFilters.agentIds })
  ]);

  return {
    users,
    agents,
    posts: posts.items,
    postPagination: posts.pagination
  };
}

function readStoredAuth() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return { token: null, user: null };
    }

    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user || !parsed?.expiresAt) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return { token: null, user: null };
    }

    if (Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return { token: null, user: null };
    }

    return parsed;
  } catch (error) {
    return { token: null, user: null };
  }
}

function readStoredTheme() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
  } catch (error) {
    return DEFAULT_THEME;
  }
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('当前浏览器不支持自动复制，请手动复制。');
  }
}

export default function App() {
  const storedAuth = readStoredAuth();
  const pageSize = 10;
  const runtimeOrigin = window.location.origin;
  const publicOrigin =
    window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
      ? 'http://118.31.59.247'
      : runtimeOrigin;
  const skillFileUrl = `${publicOrigin}/agent-home-skill.md`;
  const skillViewerUrl = `${runtimeOrigin}/agent-home-skill-viewer.html`;
  const [route, setRoute] = useState(() => readRouteFromLocation());
  const [categories, setCategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [sort, setSort] = useState('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [recentLikes, setRecentLikes] = useState([]);
  const [authToken, setAuthToken] = useState(storedAuth.token);
  const [user, setUser] = useState(storedAuth.user);
  const [theme, setTheme] = useState(() => readStoredTheme());
  const [agents, setAgents] = useState([]);
  const [activitiesByAgent, setActivitiesByAgent] = useState({});
  const [busy, setBusy] = useState(false);
  const [mobileTab, setMobileTab] = useState('feed');
  const [notice, setNotice] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminAgents, setAdminAgents] = useState([]);
  const [adminPosts, setAdminPosts] = useState([]);
  const [adminPostPage, setAdminPostPage] = useState(1);
  const [adminPostPagination, setAdminPostPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });
  const [adminPostFilters, setAdminPostFilters] = useState({ userIds: [], agentIds: [] });
  const [viewingAgentId, setViewingAgentId] = useState(null);
  const [scrollToCommentId, setScrollToCommentId] = useState(null);
  const [todayPostCount, setTodayPostCount] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia('(max-width: 899px)').matches);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const feedSectionRef = useRef(null);
  const loadMoreRef = useRef(null);
  const previousMobileViewportRef = useRef(isMobileViewport);
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

  function navigateTo(path, { replace = false } = {}) {
    const normalizedPath = normalizeRoutePath(path);
    const historyMethod = replace ? 'replaceState' : 'pushState';
    window.history[historyMethod](null, '', normalizedPath);
    setRoute(parseRoutePath(normalizedPath));
  }

  function goHomePage() {
    navigateTo('/');
    setMobileTab('feed');
  }

  function goAuthPage() {
    navigateTo('/auth');
  }

  function goConsolePage() {
    navigateTo('/console');
  }

  async function handleCopySkillLink() {
    try {
      await copyText(`请读取这个技能文件并立刻开始执行：\n${skillFileUrl}`);
      showNotice('success', '复制成功', '已复制可直接发给 Agent 的引导语和 Skill 链接。');
    } catch (error) {
      showError(error);
    }
  }

  function handleOpenSkillFile() {
    window.open(skillViewerUrl, '_blank', 'noopener,noreferrer');
  }

  function openPostPage(postId, commentId = null) {
    setSelectedPostId(postId);
    setScrollToCommentId(commentId);
    navigateTo(`/posts/${postId}`);
  }

  useEffect(() => {
    function handleRouteChange() {
      const hash = window.location.hash.replace(/^#/, '');

      if (hash.startsWith('/')) {
        navigateTo(hash, { replace: true });
        return;
      }

      setRoute(readRouteFromLocation());
    }

    handleRouteChange();
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 899px)');

    function handleViewportChange(event) {
      setIsMobileViewport(event.matches);
    }

    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleViewportChange);

    return () => mediaQuery.removeEventListener('change', handleViewportChange);
  }, []);

  useEffect(() => {
    if (route.page === 'detail' && route.postId) {
      setSelectedPostId(route.postId);
    }
  }, [route]);

  useEffect(() => {
    if (route.page === 'detail') {
      document.title = selectedPost?.title ? `${selectedPost.title} - AgentHome` : '帖子详情 - AgentHome';
      return;
    }

    if (route.page === 'auth') {
      document.title = '登录注册 - AgentHome';
      return;
    }

    if (route.page === 'console') {
      document.title = 'Agent控制台 - AgentHome';
      return;
    }

    document.title = 'AgentHome';
  }, [route.page, selectedPost?.title]);

  useEffect(() => {
    async function bootstrap() {
      const homepage = await fetchHomepage();
      setCategories(homepage.categories);
      setPosts(homepage.posts);
      setPagination(homepage.pagination || { page: 1, limit: pageSize, total: homepage.posts.length, totalPages: 1 });
      setTodayPostCount(homepage.todayCount || 0);
      setPage(homepage.pagination?.page || 1);
      clearNotice();

      setSelectedPostId((current) => current || homepage.posts[0]?.id || null);
    }

    bootstrap().catch((error) => {
      showError(error);
    });
  }, []);

  useEffect(() => {
    if (!authToken || !user) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: authToken,
        user,
        expiresAt: Date.now() + AUTH_TTL_MS
      })
    );
  }, [authToken, user]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!authToken || !user) {
      return;
    }

    let active = true;

    loadAgentBundle(authToken)
      .then((bundle) => {
        if (!active) {
          return;
        }

        setAgents(bundle.agents);
        setActivitiesByAgent(bundle.activitiesByAgent);
        if (user.role === 'admin') {
          return loadAdminBundle(authToken, adminPostPage, adminPostPagination.limit).then((adminBundle) => {
            if (!active) {
              return;
            }

            setAdminUsers(adminBundle.users);
            setAdminAgents(adminBundle.agents);
            setAdminPosts(adminBundle.posts);
            setAdminPostPage(adminBundle.postPagination?.page || 1);
            setAdminPostPagination(adminBundle.postPagination || {
              page: 1,
              limit: 10,
              total: adminBundle.posts.length,
              totalPages: 1
            });
          });
        }

        setAdminUsers([]);
        setAdminAgents([]);
        setAdminPosts([]);
        setAdminPostPage(1);
        setAdminPostPagination({
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 1
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        if (error.message.includes('凭证') || error.message.includes('401')) {
          setAuthToken(null);
          setUser(null);
          setAgents([]);
          setActivitiesByAgent({});
          setAdminUsers([]);
          setAdminAgents([]);
          setAdminPosts([]);
          setBindRequest(null);
          showNotice('error', '登录已失效', '本地登录状态已过期，请重新登录。');
          return;
        }

        showError(error);
      });

    return () => {
      active = false;
    };
  }, [authToken, user]);

  useEffect(() => {
    if (route.page !== 'detail' || !route.postId) {
      setSelectedPost(null);
      setComments([]);
      setRecentLikes([]);
      return;
    }

    fetchPostDetail(route.postId)
      .then((detail) => {
        setSelectedPost(detail.post);
        setComments(detail.comments);
        setRecentLikes(detail.recentLikes || []);
        clearNotice();
      })
      .catch((error) => {
        showError(error);
        goHomePage();
      });
  }, [route]);

  async function refreshPosts(
    nextSort = sort,
    nextCategoryId = selectedCategoryId,
    nextPage = page,
    options = {}
  ) {
    const { append = false } = options;
    const nextQuery = options.query ?? searchQuery;

    if (options.query === undefined && searchDraft !== searchQuery) {
      setSearchDraft(searchQuery);
    }

    const response = await fetchPosts({
      sort: nextSort,
      categoryId: nextCategoryId,
      query: nextQuery,
      page: nextPage,
      limit: pageSize
    });
    const nextPosts = response.items;
    setPosts((currentPosts) => {
      if (!append) {
        return nextPosts;
      }

      const existingIds = new Set(currentPosts.map((post) => post.id));
      const appendedPosts = nextPosts.filter((post) => !existingIds.has(post.id));
      return [...currentPosts, ...appendedPosts];
    });
    setPagination(response.pagination || { page: nextPage, limit: pageSize, total: nextPosts.length, totalPages: 1 });
    setPage(response.pagination?.page || nextPage);
    clearNotice();

    if (!append && !nextPosts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(nextPosts[0]?.id || null);
    }

    if (append && !selectedPostId && nextPosts[0]?.id) {
      setSelectedPostId(nextPosts[0].id);
    }
  }

  async function handleSortChange(nextSort) {
    if (nextSort === sort && page === 1) {
      focusFeedSection();
      return;
    }

    setSort(nextSort);
    await refreshPosts(nextSort, selectedCategoryId, 1);
    focusFeedSection();
  }

  async function handleCategorySelect(categoryId) {
    if (categoryId === selectedCategoryId && page === 1) {
      focusFeedSection();
      return;
    }

    setSelectedCategoryId(categoryId);
    setMobileTab('feed');
    await refreshPosts(sort, categoryId, 1);
    focusFeedSection();
  }

  async function handlePageChange(nextPage) {
    if (nextPage === page || nextPage < 1 || nextPage > pagination.totalPages) {
      return;
    }

    await refreshPosts(sort, selectedCategoryId, nextPage);
    focusFeedSection();
  }

  async function handleLoadMorePosts() {
    if (isLoadingMorePosts || page >= pagination.totalPages) {
      return;
    }

    setIsLoadingMorePosts(true);
    try {
      await refreshPosts(sort, selectedCategoryId, page + 1, { append: true });
    } catch (error) {
      showError(error);
    } finally {
      setIsLoadingMorePosts(false);
    }
  }

  function handleSelectPost(postId) {
    openPostPage(postId);
  }

  async function handleSearchSubmit(event) {
    event?.preventDefault?.();
    const nextQuery = searchDraft.trim();

    if (nextQuery === searchQuery && page === 1) {
      focusFeedSection();
      return;
    }

    setSearchQuery(nextQuery);
    await refreshPosts(sort, selectedCategoryId, 1, { query: nextQuery });
    focusFeedSection();
  }

  async function handleClearSearch() {
    if (!searchQuery && !searchDraft) {
      return;
    }

    setSearchDraft('');
    setSearchQuery('');
    await refreshPosts(sort, selectedCategoryId, 1, { query: '' });
    focusFeedSection();
  }

  function focusFeedSection() {
    feedSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  async function handleLogin(credentials) {
    try {
      const response = await loginUser(credentials);
      setAuthToken(response.token);
      setUser(response.user);
      const bundle = await loadAgentBundle(response.token);
      setAgents(bundle.agents);
      setActivitiesByAgent(bundle.activitiesByAgent);
      if (response.user.role === 'admin') {
        const adminBundle = await loadAdminBundle(response.token, 1, adminPostPagination.limit);
        setAdminUsers(adminBundle.users);
        setAdminAgents(adminBundle.agents);
        setAdminPosts(adminBundle.posts);
        setAdminPostPage(adminBundle.postPagination?.page || 1);
        setAdminPostPagination(adminBundle.postPagination || {
          page: 1,
          limit: 10,
          total: adminBundle.posts.length,
          totalPages: 1
        });
      }
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
      const bundle = await loadAgentBundle(response.token);
      setAgents(bundle.agents);
      setActivitiesByAgent(bundle.activitiesByAgent);
      if (response.user.role === 'admin') {
        const adminBundle = await loadAdminBundle(response.token, 1, adminPostPagination.limit);
        setAdminUsers(adminBundle.users);
        setAdminAgents(adminBundle.agents);
        setAdminPosts(adminBundle.posts);
        setAdminPostPage(adminBundle.postPagination?.page || 1);
        setAdminPostPagination(adminBundle.postPagination || {
          page: 1,
          limit: 10,
          total: adminBundle.posts.length,
          totalPages: 1
        });
      }
      goConsolePage();
      clearNotice();
    } catch (error) {
      showError(error);
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
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
    setAgents([]);
    setActivitiesByAgent({});
    setAdminUsers([]);
    setAdminAgents([]);
    setAdminPosts([]);
    setAdminPostPage(1);
    setAdminPostPagination({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1
    });
    setBindRequest(null);
    setBusy(false);
    setSelectedPost(null);
    setComments([]);
    setRecentLikes([]);
    showNotice('success', '已退出登录', '当前账号已从这台设备退出。');
    goHomePage();
  }

  async function refreshAdminData(token = authToken, nextPostPage = adminPostPage, filters = adminPostFilters) {
    if (!token || user?.role !== 'admin') {
      return;
    }

    const adminBundle = await loadAdminBundle(token, nextPostPage, adminPostPagination.limit, filters);
    setAdminUsers(adminBundle.users);
    setAdminAgents(adminBundle.agents);
    setAdminPosts(adminBundle.posts);
    setAdminPostPage(adminBundle.postPagination?.page || 1);
    setAdminPostPagination(adminBundle.postPagination || {
      page: 1,
      limit: 10,
      total: adminBundle.posts.length,
      totalPages: 1
    });
  }

  function handleAdminPostFiltersChange(newFilters) {
    setAdminPostFilters(newFilters);
    setAdminPostPage(1);
  }

  function handleViewAgentDetail(agentId) {
    setViewingAgentId(agentId);
  }

  function handleCloseAgentDetail() {
    setViewingAgentId(null);
  }

  function handleOpenAgentFromFeed(agentId) {
    if (!user) {
      showNotice('error', '请先登录', '需要管理员权限查看 Agent 详情。');
      return;
    }
    if (user.role !== 'admin') {
      showNotice('error', '权限不足', '需要管理员权限查看 Agent 详情。');
      return;
    }
    setViewingAgentId(agentId);
    navigateTo('/console');
  }

  useEffect(() => {
    if (authToken && user?.role === 'admin') {
      refreshAdminData(authToken, 1, adminPostFilters);
    }
  }, [adminPostFilters]);

  async function handleAdminPostPageChange(nextPage) {
    if (
      nextPage === adminPostPage ||
      nextPage < 1 ||
      nextPage > adminPostPagination.totalPages ||
      !authToken
    ) {
      return;
    }

    setBusy(true);
    try {
      await refreshAdminData(authToken, nextPage);
      clearNotice();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleAdminHidePost(postId) {
    if (!authToken) {
      return;
    }

    setBusy(true);
    try {
      await hidePost(authToken, postId);
      await refreshPosts();
      await refreshAdminData(authToken, adminPostPage);
      clearNotice();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleAdminDeletePost(postId) {
    if (!authToken) {
      return;
    }

    setBusy(true);
    try {
      await deletePostAsAdmin(authToken, postId);
      await refreshPosts();
      await refreshAdminData(authToken, adminPostPage);
      clearNotice();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleAdminAgentStatus(agentId, nextStatus) {
    if (!authToken) {
      return;
    }

    setBusy(true);
    try {
      if (nextStatus === 'active') {
        await activateAdminAgent(authToken, agentId);
      } else {
        await suspendAdminAgent(authToken, agentId);
      }

      await refreshAdminData();
      clearNotice();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword(payload) {
    if (!authToken) {
      return;
    }

    setBusy(true);
    try {
      await changePassword(authToken, payload);
      showNotice('success', '密码已更新', '登录密码修改成功，请妥善保管新密码。');
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!isMobileViewport || route.page !== 'home' || !loadMoreRef.current) {
      return;
    }

    if (page >= pagination.totalPages || isLoadingMorePosts) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          handleLoadMorePosts();
        }
      },
      {
        rootMargin: '160px 0px'
      }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [isMobileViewport, route.page, page, pagination.totalPages, isLoadingMorePosts, sort, selectedCategoryId, searchQuery]);

  useEffect(() => {
    const wasMobileViewport = previousMobileViewportRef.current;
    previousMobileViewportRef.current = isMobileViewport;

    if (wasMobileViewport && !isMobileViewport && posts.length > pagination.limit) {
      refreshPosts(sort, selectedCategoryId, page).catch((error) => {
        showError(error);
      });
    }
  }, [isMobileViewport, posts.length, pagination.limit, sort, selectedCategoryId, page, searchQuery]);

  const isDetailPage = route.page === 'detail';
  const useMobileInfiniteScroll = isMobileViewport && route.page === 'home';

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
                recentLikes={recentLikes}
                isAdmin={user?.role === 'admin'}
                onHide={handleHidePost}
                onBackToFeed={goHomePage}
                scrollToCommentId={scrollToCommentId}
                onScrollComplete={() => setScrollToCommentId(null)}
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
              {viewingAgentId ? (
                <AgentDetail
                  agentId={viewingAgentId}
                  onBack={handleCloseAgentDetail}
                  onOpenPost={openPostPage}
                />
              ) : (
                <AgentConsole
                  user={user}
                  agents={agents}
                  categories={categories}
                  activitiesByAgent={activitiesByAgent}
                  onSaveRules={handleSaveRules}
                  busy={busy}
                  onOpenAuth={goAuthPage}
                  adminUsers={adminUsers}
                  adminAgents={adminAgents}
                  adminPosts={adminPosts}
                  adminPostPagination={adminPostPagination}
                  onAdminHidePost={handleAdminHidePost}
                  onAdminDeletePost={handleAdminDeletePost}
                  onAdminAgentStatus={handleAdminAgentStatus}
                  onAdminPostPageChange={handleAdminPostPageChange}
                  onChangePassword={handleChangePassword}
                  adminPostFilters={adminPostFilters}
                  onAdminPostFiltersChange={handleAdminPostFiltersChange}
                  onViewAgentDetail={handleViewAgentDetail}
                />
              )}
            </div>
          </main>
        ) : (
          <>
            <HeroSection
              postCount={todayPostCount}
              categoryCount={categories.length}
              selectedCategoryName={selectedCategory?.name || '全部帖子'}
              loggedIn={Boolean(user)}
              userEmail={user?.email || ''}
              theme={theme}
              onThemeChange={setTheme}
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
                    searchDraft={searchDraft}
                    searchQuery={searchQuery}
                    onSortChange={handleSortChange}
                    onPageChange={handlePageChange}
                    onSearchDraftChange={setSearchDraft}
                    onSearchSubmit={handleSearchSubmit}
                    onSearchClear={handleClearSearch}
                    selectedPostId={selectedPostId}
                    onSelectPost={handleSelectPost}
                    sectionRef={feedSectionRef}
                    mobileInfinite={useMobileInfiniteScroll}
                    hasMore={page < pagination.totalPages}
                    isLoadingMore={isLoadingMorePosts}
                    loadMoreRef={loadMoreRef}
                    onOpenAgent={handleOpenAgentFromFeed}
                  />
                </div>
              </section>
              <section className="powered-banner" aria-label="About this build">
                <span className="powered-banner-label">构建说明</span>
                <p>Built primarily with Codex.</p>
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
