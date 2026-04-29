import { useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { Activity, Eye, EyeOff, LogIn, Shield, UserCheck, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authStore } from '@/stores';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Input } from '@/components/Input';
import s from './Login.module.scss';

interface DemoAccount {
  login: string;
  password: string;
  role: string;
  hint: string;
  icon: LucideIcon;
  color: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { login: 'admin',    password: 'admin123',   role: 'Администратор', hint: 'Полный доступ ко всем разделам', icon: Shield,    color: 'var(--success)' },
  { login: 'trainer1', password: 'trainer123', role: 'Тренер',        hint: 'Клиенты, программы, аналитика',  icon: UserCheck, color: 'var(--info)' },
  { login: 'client1',  password: 'client123',  role: 'Клиент',        hint: 'Дашборд и свои программы',       icon: User,      color: 'var(--purple)' },
];

const Login = observer(() => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await authStore.login(login, password);
    } catch { /* error displayed via authStore.error */ }
  };

  const fillDemo = (account: DemoAccount) => {
    setLogin(account.login);
    setPassword(account.password);
    authStore.error = null;
  };

  return (
    <div className={s.root}>
      <div className={s.shell}>
        <header className={s.brand}>
          <div className={s.brandIcon}><Activity size={28} color="var(--bg-0)" /></div>
          <div>
            <div className={s.brandTitle}>
              Fit<span className={s.brandAccent}>Analytics</span>
            </div>
            <div className={s.brandSubtitle}>
              Анализ персонализированных тренировочных программ
            </div>
          </div>
        </header>

        <section className={s.card}>
          <h2 className={s.cardTitle}>Вход в систему</h2>
          <p className={s.cardSubtitle}>Введите учётные данные для доступа</p>

          <form onSubmit={handleSubmit} className={s.form}>
            <Field label="Логин">
              <Input
                type="text"
                placeholder="admin / trainer1 / client1"
                value={login}
                onChange={e => { setLogin(e.target.value); authStore.error = null; }}
                autoComplete="username"
                required
              />
            </Field>

            <Field label="Пароль">
              <div className={s.passwordWrap}>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); authStore.error = null; }}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className={s.eyeBtn}
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {authStore.error && (
              <div className={s.errorBanner}>{authStore.error}</div>
            )}

            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={authStore.isLoading}
              iconLeft={<LogIn size={16} />}
            >
              Войти
            </Button>
          </form>
        </section>

        <section className={s.demos}>
          <div className={s.demosTitle}>Демо-аккаунты</div>
          <div className={s.demosList}>
            {DEMO_ACCOUNTS.map(acc => {
              const Icon = acc.icon;
              return (
                <button
                  key={acc.login}
                  className={s.demo}
                  onClick={() => fillDemo(acc)}
                  type="button"
                >
                  <span
                    className={s.demoIcon}
                    style={{
                      background: `color-mix(in srgb, ${acc.color} 12%, transparent)`,
                      color: acc.color,
                    }}
                  >
                    <Icon size={14} />
                  </span>
                  <span className={s.demoBody}>
                    <span className={s.demoRole}>
                      {acc.role}
                      <span className={s.demoLogin}> / {acc.login}</span>
                    </span>
                    <span className={s.demoHint}>{acc.hint}</span>
                  </span>
                  <code className={s.demoPwd}>{acc.password}</code>
                </button>
              );
            })}
          </div>
        </section>

        <footer className={s.footer}>
          ВКР • Бакалавриат • FitAnalytics v2.0.0
        </footer>
      </div>
    </div>
  );
});

export default Login;
