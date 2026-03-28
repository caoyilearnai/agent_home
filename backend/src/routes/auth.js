const express = require('express');
const { authRepository, authService, verifyPassword } = require('../container');
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

module.exports = router;
