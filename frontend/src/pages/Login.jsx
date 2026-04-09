import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Activity, Eye, EyeOff, LogIn, Shield, UserCheck, User } from 'lucide-react';
import { authStore } from '../stores';

const DEMO_ACCOUNTS = [
  {
    login: 'admin',
    password: 'admin123',
    role: 'Администратор',
    icon: Shield,
    color: '#00d4aa',
    bg: 'var(--success-soft)',
    hint: 'Полный доступ ко всем разделам',
  },
  {
    login: 'trainer1',
    password: 'trainer123',
    role: 'Тренер',
    icon: UserCheck,
    color: '#5c7cfa',
    bg: 'var(--info-soft)',
    hint: 'Клиенты, программы, аналитика',
  },
  {
    login: 'client1',
    password: 'client123',
    role: 'Клиент',
    icon: User,
    color: '#a855f7',
    bg: 'var(--purple-soft)',
    hint: 'Дашборд и свои программы',
  },
];

const Login = observer(() => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await authStore.login(login, password);
    } catch {
      // error shown via authStore.error
    }
  };

  const fillDemo = (account) => {
    setLogin(account.login);
    setPassword(account.password);
    authStore.error = null;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px', justifyContent: 'center' }}>
          <div style={{
            width: '52px', height: '52px',
            background: 'linear-gradient(135deg, #00d4aa, #00b894)',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(0,212,170,0.3)',
          }}>
            <Activity size={28} color="#0a0a0f" />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
              Fit<span style={{ color: '#00d4aa' }}>Analytics</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Система анализа тренировочных программ</div>
          </div>
        </div>

        {/* Login card */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.25rem', marginBottom: '4px' }}>Вход в систему</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '28px' }}>
            Введите учётные данные для доступа
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Логин</label>
              <input
                type="text"
                className="form-input"
                placeholder="Введите логин"
                value={login}
                onChange={e => { setLogin(e.target.value); authStore.error = null; }}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '8px' }}>
              <label className="form-label">Пароль</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={e => { setPassword(e.target.value); authStore.error = null; }}
                  autoComplete="current-password"
                  required
                  style={{ paddingRight: '48px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {authStore.error && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px',
                background: 'var(--danger-soft)', color: 'var(--danger)',
                fontSize: '0.875rem', marginBottom: '16px',
              }}>
                {authStore.error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={authStore.isLoading}
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px', padding: '14px' }}
            >
              {authStore.isLoading
                ? <span style={{ opacity: 0.7 }}>Выполняется вход...</span>
                : <><LogIn size={18} /> Войти</>
              }
            </button>
          </form>
        </div>

        {/* Demo accounts */}
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
            Демо-аккаунты
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              return (
                <button
                  key={acc.login}
                  onClick={() => fillDemo(acc)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '10px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    cursor: 'pointer', transition: 'all 150ms ease', textAlign: 'left',
                    width: '100%',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = acc.color}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '8px',
                    background: acc.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={16} color={acc.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {acc.role} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {acc.login}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>{acc.hint}</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                    {acc.password}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          ВКР Бакалавра · FitAnalytics v1.0.0
        </div>
      </div>
    </div>
  );
});

export default Login;
