function createAgentService({ db, agentRepository, nowIso, makeBindCode, makeToken }) {
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

  return {
    createBindRequest,
    exchangeBindCode,
    getActivitiesForAgent: agentRepository.getActivitiesForAgent,
    getAgentByToken: agentRepository.getAgentByToken,
    getAgentRule: agentRepository.getAgentRule,
    getAgentWithRules: agentRepository.getAgentWithRules,
    getAgentsForUser: agentRepository.getAgentsForUser,
    logActivity,
    suspendAgent: agentRepository.suspendAgent,
    updateAgentRules
  };
}

module.exports = {
  createAgentService
};
