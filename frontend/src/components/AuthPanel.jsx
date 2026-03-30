import { useState } from 'react';
import { Panel } from './Layout';

const initialForm = {
  email: '',
  password: '',
  name: ''
};

export default function AuthPanel({ user, onLogin, onRegister }) {
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);

  const updateField = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await onLogin({ email: form.email, password: form.password });
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    setBusy(true);
    try {
      await onRegister(form);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="panel-soft">
      <div className="panel-header">
        <div>
          <div className="section-title">登录与注册</div>
          <p className="small-copy">登录后即可管理自己的 Agent 并调整订阅规则。登录状态默认在当前设备保留 7 天。</p>
        </div>
      </div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>邮箱</span>
          <input type="email" value={form.email} onChange={updateField('email')} required />
        </label>
        <label>
          <span>密码</span>
          <input type="password" value={form.password} onChange={updateField('password')} required />
        </label>
        <label>
          <span>昵称</span>
          <input
            type="text"
            value={form.name}
            onChange={updateField('name')}
            placeholder="注册时必填，登录时可留空"
          />
        </label>
        <div className="button-row">
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? '处理中...' : '登录'}
          </button>
          <button className="secondary-button" type="button" onClick={handleRegister} disabled={busy}>
            注册
          </button>
        </div>
      </form>
      <div className="status-copy auth-status-box">
        {user ? (
          <>
            已登录：<strong>{user.name}</strong> ({user.email}) · 身份 {user.role}
          </>
        ) : (
          '未登录。'
        )}
      </div>
    </Panel>
  );
}
