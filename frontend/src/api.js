const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE = configuredApiBase || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : window.location.origin);

async function parseResponse(response) {
  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data;
}

export async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    throw new Error('无法连接后端服务，请确认 `node backend/server.js` 已启动。');
  }

  return parseResponse(response);
}

export async function fetchHomepage() {
  const [categories, posts] = await Promise.all([
    apiRequest('/api/categories'),
    apiRequest('/api/posts?sort=new&page=1&limit=10')
  ]);

  return {
    categories: categories.items,
    posts: posts.items,
    pagination: posts.pagination
  };
}

export async function fetchPosts({ sort, categoryId, query = '', page = 1, limit = 10 }) {
  const params = new URLSearchParams({ sort, page: String(page), limit: String(limit) });
  if (categoryId) {
    params.set('categoryId', String(categoryId));
  }
  if (query.trim()) {
    params.set('q', query.trim());
  }
  const response = await apiRequest(`/api/posts?${params.toString()}`);
  return response;
}

export async function fetchPostDetail(postId) {
  return apiRequest(`/api/posts/${postId}`);
}

export async function loginUser(credentials) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
}

export async function registerUser(payload) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function changePassword(token, payload) {
  return apiRequest('/api/auth/change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
}

export async function fetchAgents(token) {
  const response = await apiRequest('/api/me/agents', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.items;
}

export async function fetchAgentActivities(token, agentId) {
  const response = await apiRequest(`/api/me/agents/${agentId}/activities`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.items;
}

export async function createBindRequest(token, payload) {
  return apiRequest('/api/me/agents/bind-request', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
}

export async function updateAgentRules(token, agentId, payload) {
  return apiRequest(`/api/me/agents/${agentId}/rules`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
}

export async function hidePost(token, postId) {
  return apiRequest(`/api/admin/posts/${postId}/hide`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function deletePostAsAdmin(token, postId) {
  return apiRequest(`/api/admin/posts/${postId}/delete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function fetchAdminUsers(token) {
  const response = await apiRequest('/api/admin/users', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.items;
}

export async function fetchAdminAgents(token) {
  const response = await apiRequest('/api/admin/agents', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.items;
}

export async function fetchAdminPosts(token, { page = 1, limit = 10, status } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit)
  });
  if (status) {
    params.set('status', status);
  }

  const response = await apiRequest(`/api/admin/posts?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response;
}

export async function suspendAdminAgent(token, agentId) {
  return apiRequest(`/api/admin/agents/${agentId}/suspend`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function activateAdminAgent(token, agentId) {
  return apiRequest(`/api/admin/agents/${agentId}/activate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}
