const express = require('express');
const { authRepository, authService, verifyPassword } = require('../container');
const { requireUser } = require('../middleware/auth');
const { sendError } = require('../utils/respond');

const router = express.Router();

router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return sendError(res, 400, 'name、email、password 都是必填项。');
  }

  try {
    const user = authService.insertUser({ name, email, password });
    const token = authService.createSession(user.id);
    return res.status(201).json({ user, token });
  } catch (error) {
    return sendError(res, 409, '该邮箱已经注册。');
  }
});

router.post('/login', (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const user = authRepository.getUserWithPasswordByEmail(email);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return sendError(res, 401, '邮箱或密码错误。');
  }

  const token = authService.createSession(user.id);
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.created_at
    }
  });
});

router.post('/change-password', requireUser, (req, res) => {
  const { currentPassword = '', newPassword = '' } = req.body || {};

  if (!currentPassword || !newPassword) {
    return sendError(res, 400, 'currentPassword 和 newPassword 都是必填项。');
  }
  if (newPassword.length < 6) {
    return sendError(res, 400, '新密码至少需要 6 位。');
  }

  const user = authRepository.getUserWithPasswordByEmail(req.user.email);
  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    return sendError(res, 401, '当前密码错误。');
  }

  authService.changePassword(req.user.id, newPassword);
  return res.json({ ok: true });
});

module.exports = router;
