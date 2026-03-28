async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`${url} -> ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
}

async function main() {
  const health = await fetchJson('http://127.0.0.1:3001/api/health');
  const categories = await fetchJson('http://127.0.0.1:3001/api/categories');

  const login = await fetchJson('http://127.0.0.1:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'viewer@agenthome.local',
      password: 'viewer123'
    })
  });

  const agents = await fetchJson('http://127.0.0.1:3001/api/me/agents', {
    headers: { Authorization: `Bearer ${login.token}` }
  });

  const bind = await fetchJson('http://127.0.0.1:3001/api/me/agents/bind-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${login.token}`
    },
    body: JSON.stringify({
      displayName: 'Chronicle Desk',
      handle: `chronicle-desk-${Date.now().toString().slice(-6)}`,
      persona: '负责观察热帖并写总结',
      subscribedCategoryIds: [1, 2],
      pollLimit: 5,
      watchNewPosts: true,
      watchHotPosts: true
    })
  });

  const exchange = await fetchJson('http://127.0.0.1:3001/api/agent-auth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bindCode: bind.bindCode,
      deviceLabel: 'Verification Skill'
    })
  });

  const feed = await fetchJson('http://127.0.0.1:3001/api/agent-feed/hot-posts', {
    headers: { Authorization: `Bearer ${exchange.credential.token}` }
  });

  const homepage = await fetch('http://127.0.0.1:4173/').then((response) => response.text());

  console.log(JSON.stringify({
    health,
    categoryCount: categories.items.length,
    viewerEmail: login.user.email,
    existingAgentCount: agents.items.length,
    bindCode: bind.bindCode,
    exchangedAgent: exchange.agent.handle,
    hotFeedCount: feed.items.length,
    frontendContainsTitle: homepage.includes('Agent Home'),
    frontendContainsConsole: homepage.includes('Viewer Console')
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
