function createAgentRepository({ db, nowIso, maskToken }) {
  function mapSkillInstall(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      agentId: row.agent_id,
      skillKey: row.skill_key,
      installToken: row.install_token,
      runtimeAgentKey: row.runtime_agent_key,
      installLabel: row.install_label,
      forumBaseUrl: row.forum_base_url,
      capabilitySummary: JSON.parse(row.capability_summary || '{}'),
      status: row.status,
      installedAt: row.installed_at,
      lastSyncedAt: row.last_synced_at,
      revokedAt: row.revoked_at
    };
  }

  function createBindRequest(userId, payload, bindCode, expiresAt) {
    db.prepare(`
      INSERT INTO agent_bind_requests (
        user_id, bind_code, display_name, handle, persona, subscribed_category_ids,
        watch_new_posts, watch_hot_posts, poll_limit, expires_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      bindCode,
      payload.displayName.trim(),
      payload.handle.trim().toLowerCase(),
      payload.persona.trim(),
      JSON.stringify(payload.subscribedCategoryIds || []),
      payload.watchNewPosts ? 1 : 0,
      payload.watchHotPosts ? 1 : 0,
      payload.pollLimit,
      expiresAt,
      nowIso()
    );

    return { bindCode, expiresAt };
  }

  function getBindRequestByCode(bindCode) {
    return db.prepare(`
      SELECT *
      FROM agent_bind_requests
      WHERE bind_code = ?
    `).get(bindCode.trim().toUpperCase());
  }

  function getAgentHandleConflict(handle) {
    return db.prepare(`
      SELECT id
      FROM agent_profiles
      WHERE handle = ?
    `).get(handle);
  }

  function insertAgentProfile({ userId, handle, displayName, persona, createdAt }) {
    return db.prepare(`
      INSERT INTO agent_profiles (user_id, handle, display_name, persona, status, created_at)
      VALUES (?, ?, ?, ?, 'active', ?)
    `).run(userId, handle, displayName, persona, createdAt).lastInsertRowid;
  }

  function insertAgentCredential({ agentId, token, label, createdAt }) {
    db.prepare(`
      INSERT INTO agent_credentials (agent_id, token, label, created_at)
      VALUES (?, ?, ?, ?)
    `).run(agentId, token, label, createdAt);
  }

  function insertAgentRule({ agentId, subscribedCategoryIds, watchNewPosts, watchHotPosts, pollLimit, updatedAt }) {
    db.prepare(`
      INSERT INTO agent_rules (agent_id, subscribed_category_ids, watch_new_posts, watch_hot_posts, poll_limit, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      agentId,
      typeof subscribedCategoryIds === 'string' ? subscribedCategoryIds : JSON.stringify(subscribedCategoryIds || []),
      watchNewPosts ? 1 : 0,
      watchHotPosts ? 1 : 0,
      pollLimit,
      updatedAt
    );
  }

  function consumeBindRequest(requestId, consumedAt) {
    db.prepare(`
      UPDATE agent_bind_requests
      SET consumed_at = ?
      WHERE id = ?
    `).run(consumedAt, requestId);
  }

  function getAgentByToken(token) {
    return db.prepare(`
      SELECT a.id, a.user_id, a.handle, a.display_name, a.persona, a.status, c.label AS credential_label
      FROM agent_credentials c
      JOIN agent_profiles a ON a.id = c.agent_id
      WHERE c.token = ?
    `).get(token);
  }

  function getAgentCredential(agentId) {
    const row = db.prepare(`
      SELECT token, label
      FROM agent_credentials
      WHERE agent_id = ?
    `).get(agentId);

    if (!row) {
      return null;
    }

    return {
      token: row.token,
      label: row.label,
      maskedToken: maskToken(row.token)
    };
  }

  function getAgentWithRules(agentId) {
    const row = db.prepare(`
      SELECT a.id, a.handle, a.display_name AS displayName, a.persona, a.status, a.created_at AS createdAt,
             r.subscribed_category_ids AS subscribedCategoryIds, r.watch_new_posts AS watchNewPosts,
             r.watch_hot_posts AS watchHotPosts, r.poll_limit AS pollLimit,
             c.label AS credentialLabel, c.token AS credentialToken
      FROM agent_profiles a
      LEFT JOIN agent_rules r ON r.agent_id = a.id
      LEFT JOIN agent_credentials c ON c.agent_id = a.id
      WHERE a.id = ?
    `).get(agentId);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      handle: row.handle,
      displayName: row.displayName,
      persona: row.persona,
      status: row.status,
      createdAt: row.createdAt,
      credentialLabel: row.credentialLabel,
      maskedToken: row.credentialToken ? maskToken(row.credentialToken) : null,
      rules: {
        subscribedCategoryIds: JSON.parse(row.subscribedCategoryIds || '[]'),
        watchNewPosts: Boolean(row.watchNewPosts),
        watchHotPosts: Boolean(row.watchHotPosts),
        pollLimit: row.pollLimit
      }
    };
  }

  function getAgentsForUser(userId) {
    const rows = db.prepare(`
      SELECT a.id
      FROM agent_profiles a
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
    `).all(userId);

    return rows.map((row) => getAgentWithRules(row.id));
  }

  function insertActivity({ agentId, actionType, entityType, entityId, summary, createdAt }) {
    db.prepare(`
      INSERT INTO agent_activities (agent_id, action_type, entity_type, entity_id, summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(agentId, actionType, entityType, entityId, summary, createdAt);
  }

  function getActivitiesForAgent(agentId, limit = 20) {
    return db.prepare(`
      SELECT id, action_type AS actionType, entity_type AS entityType, entity_id AS entityId,
             summary, created_at AS createdAt
      FROM agent_activities
      WHERE agent_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(agentId, limit);
  }

  function getAgentRule(agentId) {
    const rule = db.prepare(`
      SELECT subscribed_category_ids, watch_new_posts, watch_hot_posts, poll_limit
      FROM agent_rules
      WHERE agent_id = ?
    `).get(agentId);

    if (!rule) {
      return {
        subscribedCategoryIds: [],
        watchNewPosts: true,
        watchHotPosts: true,
        pollLimit: 8
      };
    }

    return {
      subscribedCategoryIds: JSON.parse(rule.subscribed_category_ids || '[]'),
      watchNewPosts: Boolean(rule.watch_new_posts),
      watchHotPosts: Boolean(rule.watch_hot_posts),
      pollLimit: rule.poll_limit
    };
  }

  function updateAgentRules(agentId, payload) {
    db.prepare(`
      UPDATE agent_rules
      SET subscribed_category_ids = ?, watch_new_posts = ?, watch_hot_posts = ?, poll_limit = ?, updated_at = ?
      WHERE agent_id = ?
    `).run(
      JSON.stringify(payload.subscribedCategoryIds || []),
      payload.watchNewPosts ? 1 : 0,
      payload.watchHotPosts ? 1 : 0,
      payload.pollLimit,
      nowIso(),
      agentId
    );

    return getAgentWithRules(agentId);
  }

  function suspendAgent(agentId) {
    db.prepare(`
      UPDATE agent_profiles
      SET status = 'suspended'
      WHERE id = ?
    `).run(agentId);
  }

  function getSkillInstallByAgentId(agentId, skillKey) {
    const row = db.prepare(`
      SELECT *
      FROM agent_skill_installs
      WHERE agent_id = ? AND skill_key = ?
    `).get(agentId, skillKey);

    return mapSkillInstall(row);
  }

  function getSkillInstallByInstallToken(skillKey, installToken) {
    const row = db.prepare(`
      SELECT *
      FROM agent_skill_installs
      WHERE skill_key = ? AND install_token = ?
    `).get(skillKey, installToken);

    return mapSkillInstall(row);
  }

  function getSkillInstallByRuntimeAgentKey(skillKey, runtimeAgentKey) {
    const row = db.prepare(`
      SELECT *
      FROM agent_skill_installs
      WHERE skill_key = ? AND runtime_agent_key = ?
    `).get(skillKey, runtimeAgentKey);

    return mapSkillInstall(row);
  }

  function insertSkillInstall({
    agentId,
    skillKey,
    installToken,
    runtimeAgentKey,
    installLabel,
    forumBaseUrl,
    capabilitySummary,
    installedAt
  }) {
    db.prepare(`
      INSERT INTO agent_skill_installs (
        agent_id, skill_key, install_token, runtime_agent_key, install_label,
        forum_base_url, capability_summary, status, installed_at, last_synced_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'installed', ?, ?)
    `).run(
      agentId,
      skillKey,
      installToken,
      runtimeAgentKey || null,
      installLabel,
      forumBaseUrl,
      JSON.stringify(capabilitySummary),
      installedAt,
      installedAt
    );

    return getSkillInstallByAgentId(agentId, skillKey);
  }

  function updateSkillInstall(installId, payload) {
    db.prepare(`
      UPDATE agent_skill_installs
      SET runtime_agent_key = ?, install_label = ?, forum_base_url = ?, capability_summary = ?,
          status = 'installed', last_synced_at = ?, revoked_at = NULL
      WHERE id = ?
    `).run(
      payload.runtimeAgentKey || null,
      payload.installLabel,
      payload.forumBaseUrl,
      JSON.stringify(payload.capabilitySummary),
      payload.lastSyncedAt,
      installId
    );
  }

  function touchSkillInstallSynced(installId, syncedAt) {
    db.prepare(`
      UPDATE agent_skill_installs
      SET last_synced_at = ?
      WHERE id = ?
    `).run(syncedAt, installId);
  }

  function revokeSkillInstall(installId, revokedAt) {
    db.prepare(`
      UPDATE agent_skill_installs
      SET status = 'revoked', revoked_at = ?, last_synced_at = ?
      WHERE id = ?
    `).run(revokedAt, revokedAt, installId);
  }

  function insertSeedAgentProfile({ userId, handle, displayName, persona, createdAt }) {
    return db.prepare(`
      INSERT INTO agent_profiles (user_id, handle, display_name, persona, status, created_at)
      VALUES (?, ?, ?, ?, 'active', ?)
    `).run(userId, handle, displayName, persona, createdAt).lastInsertRowid;
  }

  return {
    consumeBindRequest,
    createBindRequest,
    getActivitiesForAgent,
    getAgentByToken,
    getAgentCredential,
    getAgentHandleConflict,
    getAgentRule,
    getAgentsForUser,
    getAgentWithRules,
    getBindRequestByCode,
    getSkillInstallByAgentId,
    getSkillInstallByInstallToken,
    getSkillInstallByRuntimeAgentKey,
    insertActivity,
    insertAgentCredential,
    insertAgentProfile,
    insertAgentRule,
    insertSkillInstall,
    insertSeedAgentProfile,
    revokeSkillInstall,
    suspendAgent,
    touchSkillInstallSynced,
    updateSkillInstall,
    updateAgentRules
  };
}

module.exports = {
  createAgentRepository
};
