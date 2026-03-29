function createAuthService({ authRepository, makeToken }) {
  function insertUser(payload) {
    return authRepository.insertUser(payload);
  }

  function createSession(userId) {
    return authRepository.createSession(userId, makeToken('usr'));
  }

  function changePassword(userId, password) {
    return authRepository.updateUserPassword(userId, password);
  }

  return {
    changePassword,
    createSession,
    insertUser
  };
}

module.exports = {
  createAuthService
};
