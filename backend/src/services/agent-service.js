function createAgentService({ db, agentRepository, nowIso, makeBindCode, makeToken }) {
  const FORUM_SKILL_KEY = 'agent-home-forum';

  function buildSkillCapabilitySummary(agent) {
    return {
      canCreatePosts: true,
      canCreateComments: true,
      canLike: true,
      watchFeeds: ['new', 'hot'],
      pollLimit: agent.rules.pollLimit,
      subscribedCategoryIds: agent.rules.subscribedCategoryIds,
      watchNewPosts: agent.rules.watchNewPosts,
      watchHotPosts: agent.rules.watchHotPosts
    };
  }

  function buildSkillInstallPayload(install, agent, credential) {
    return {
      ...install,
      agent,
      credential
    };
  }

  function logActivity(agentId, actionType, entityType, entityId, summary) {
    agentRepository.insertActivity({
      agentId,
      actionType,
      entityType,
      entityId,
      summary,
      createdAt: nowIso()
    });
  }

  function createBindRequest(userId, payload) {
    const bindCode = makeBindCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    return agentRepository.createBindRequest(userId, payload, bindCode, expiresAt);
  }

  function exchangeBindCode(bindCode, deviceLabel) {
    const request = agentRepository.getBindRequestByCode(bindCode);

    if (!request) {
      return { error: '绑定码不存在。' };
    }
    if (request.consumed_at) {
      return { error: '绑定码已经使用过。' };
    }
    if (new Date(request.expires_at).getTime() < Date.now()) {
      return { error: '绑定码已经过期。' };
    }
    if (agentRepository.getAgentHandleConflict(request.handle)) {
      return { error: 'Agent handle 已存在，请重新创建绑定请求。' };
    }

    db.exec('BEGIN');

    try {
      const createdAt = nowIso();
      const agentId = agentRepository.insertAgentProfile({
        userId: request.user_id,
        handle: request.handle,
        displayName: request.display_name,
        persona: request.persona,
        createdAt
      });
      const token = makeToken('agt');

      agentRepository.insertAgentCredential({
        agentId,
        token,
        label: deviceLabel.trim(),
        createdAt
      });

      agentRepository.insertAgentRule({
        agentId,
        subscribedCategoryIds: request.subscribed_category_ids,
        watchNewPosts: request.watch_new_posts,
        watchHotPosts: request.watch_hot_posts,
        pollLimit: request.poll_limit,
        updatedAt: createdAt
      });

      agentRepository.insertActivity({
        agentId,
        actionType: 'bind',
        entityType: 'agent',
        entityId: agentId,
        summary: `Agent ${request.display_name} 完成绑定并取得凭证。`,
        createdAt
      });

      agentRepository.consumeBindRequest(request.id, createdAt);
      db.exec('COMMIT');

      return {
        agent: agentRepository.getAgentWithRules(agentId),
        credential: {
          label: deviceLabel.trim(),
          token,
          maskedToken: require('../utils/security').maskToken(token)
        }
      };
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function updateAgentRules(agentId, payload) {
    const updated = agentRepository.updateAgentRules(agentId, payload);
    logActivity(agentId, 'rules', 'agent', agentId, '更新了订阅规则。');
    return updated;
  }

  function installForumSkill(agentId, payload) {
    const agent = agentRepository.getAgentWithRules(agentId);
    if (!agent) {
      return { error: 'Agent 不存在。', status: 404 };
    }
    if (agent.status !== 'active') {
      return { error: 'Agent 已被暂停。', status: 403 };
    }

    const credential = agentRepository.getAgentCredential(agentId);
    if (!credential) {
      return { error: 'Agent 凭证不存在。', status: 409 };
    }

    const runtimeAgentKey = payload.runtimeAgentKey?.trim() || null;
    const installLabel = payload.installLabel?.trim() || 'Agent Home 论坛技能';
    const capabilitySummary = buildSkillCapabilitySummary(agent);
    const existingInstall = agentRepository.getSkillInstallByAgentId(agentId, FORUM_SKILL_KEY);

    if (runtimeAgentKey) {
      const installByRuntimeKey = agentRepository.getSkillInstallByRuntimeAgentKey(FORUM_SKILL_KEY, runtimeAgentKey);
      if (installByRuntimeKey && installByRuntimeKey.agentId !== agentId) {
        return { error: 'runtimeAgentKey 已被其他 Agent 使用。', status: 409 };
      }
    }

    const timestamp = nowIso();

    if (!existingInstall) {
      const createdInstall = agentRepository.insertSkillInstall({
        agentId,
        skillKey: FORUM_SKILL_KEY,
        installToken: makeToken('skl'),
        runtimeAgentKey,
        installLabel,
        forumBaseUrl: payload.forumBaseUrl,
        capabilitySummary,
        installedAt: timestamp
      });

      logActivity(agentId, 'skill_install', 'skill', createdInstall.id, '安装了 Agent Home 论坛技能。');
      return {
        item: buildSkillInstallPayload(createdInstall, agent, credential)
      };
    }

    agentRepository.updateSkillInstall(existingInstall.id, {
      runtimeAgentKey,
      installLabel,
      forumBaseUrl: payload.forumBaseUrl,
      capabilitySummary,
      lastSyncedAt: timestamp
    });

    const updatedInstall = agentRepository.getSkillInstallByAgentId(agentId, FORUM_SKILL_KEY);
    logActivity(agentId, 'skill_install', 'skill', updatedInstall.id, '更新了 Agent Home 论坛技能安装态。');
    return {
      item: buildSkillInstallPayload(updatedInstall, agent, credential)
    };
  }

  function syncForumSkill(payload) {
    const installToken = payload.installToken?.trim();
    const runtimeAgentKey = payload.runtimeAgentKey?.trim();
    const skillKey = payload.skillKey || FORUM_SKILL_KEY;

    if (!installToken && !runtimeAgentKey) {
      return { error: 'installToken 和 runtimeAgentKey 至少需要提供一个。', status: 400 };
    }

    const install = installToken
      ? agentRepository.getSkillInstallByInstallToken(skillKey, installToken)
      : agentRepository.getSkillInstallByRuntimeAgentKey(skillKey, runtimeAgentKey);

    if (!install) {
      return { error: '未找到已安装的 Skill 记录。', status: 404 };
    }
    if (install.status !== 'installed') {
      return { error: 'Skill 安装记录已失效。', status: 410 };
    }

    const agent = agentRepository.getAgentWithRules(install.agentId);
    const credential = agentRepository.getAgentCredential(install.agentId);

    if (!agent || !credential) {
      return { error: '安装记录对应的 Agent 已失效。', status: 410 };
    }
    if (agent.status !== 'active') {
      return { error: 'Agent 已被暂停。', status: 403 };
    }

    agentRepository.touchSkillInstallSynced(install.id, nowIso());
    const updatedInstall = agentRepository.getSkillInstallByAgentId(install.agentId, skillKey);
    return {
      item: buildSkillInstallPayload(updatedInstall, agent, credential)
    };
  }

  function revokeForumSkill(agentId) {
    const install = agentRepository.getSkillInstallByAgentId(agentId, FORUM_SKILL_KEY);
    if (!install) {
      return { ok: true };
    }

    agentRepository.revokeSkillInstall(install.id, nowIso());
    logActivity(agentId, 'skill_revoke', 'skill', install.id, '撤销了 Agent Home 论坛技能安装态。');
    return { ok: true };
  }

  return {
    createBindRequest,
    exchangeBindCode,
    getAllAgents: agentRepository.getAllAgents,
    getActivitiesForAgent: agentRepository.getActivitiesForAgent,
    getAgentByToken: agentRepository.getAgentByToken,
    getAgentRule: agentRepository.getAgentRule,
    getAgentWithRules: agentRepository.getAgentWithRules,
    getAgentsForUser: agentRepository.getAgentsForUser,
    installForumSkill,
    logActivity,
    revokeForumSkill,
    skillKey: FORUM_SKILL_KEY,
    activateAgent: agentRepository.activateAgent,
    suspendAgent: agentRepository.suspendAgent,
    syncForumSkill,
    updateAgentRules
  };
}

module.exports = {
  createAgentService
};
