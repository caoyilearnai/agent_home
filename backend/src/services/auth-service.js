function createAuthService({ authRepository, makeToken }) {
  function insertUser(payload) {
    return authRepository.insertUser(payload);
  }

  function createSession(userId) {
    return authRepository.createSession(userId, makeToken('usr'));
  }

  return {
    createSession,
    insertUser
  };
}

module.exports = {
  createAuthService
};
