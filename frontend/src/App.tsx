import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, TrendingDown, DollarSign,
  Target, Activity, HelpCircle, Menu, Lightbulb, ShieldCheck,
  LogOut, Shield, UserCheck, User,
} from 'lucide-react';
import './styles/globals.css';

import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ChurnAnalytics from './pages/ChurnAnalytics';
import Revenue from './pages/Revenue';
import Programs from './pages/Programs';
import Recommendations from './pages/Recommendations';
import AccessControl from './pages/AccessControl';
import Login from './pages/Login';
import ToastContainer from './components/Toast';
import { authStore } from './stores';

// ─── Role-based navigation config ─────────────────────────────────────────────

const ALL_NAV = [
  { id: 'dashboard',       path: '/',               label: 'Дашборд',        icon: LayoutDashboard, section: 'main' },
  { id: 'clients',         path: '/clients',        label: 'Клиенты',         icon: Users,           section: 'main' },
  { id: 'churn',           path: '/churn',          label: 'Анализ оттока',   icon: TrendingDown,    section: 'analytics' },
  { id: 'revenue',         path: '/revenue',        label: 'Финансы',         icon: DollarSign,      section: 'analytics' },
  { id: 'programs',        path: '/programs',       label: 'Программы',       icon: Target,          section: 'analytics' },
  { id: 'recommendations', path: '/recommendations',label: 'Рекомендации',    icon: Lightbulb,       section: 'analytics' },
  { id: 'access',          path: '/access',         label: 'Права доступа',   icon: ShieldCheck,     section: 'system' },
];

const ROLE_PAGES: Record<string, string[]> = {
  admin:   ['dashboard', 'clients', 'churn', 'revenue', 'programs', 'recommendations', 'access'],
  trainer: ['dashboard', 'clients', 'programs', 'recommendations', 'churn'],
  client:  ['dashboard', 'programs'],
};

const ROLE_META = {
  admin:   { label: 'Администратор', icon: Shield,    color: '#00d4aa', bg: 'var(--success-soft)' },
  trainer: { label: 'Тренер',        icon: UserCheck, color: '#5c7cfa', bg: 'var(--info-soft)' },
  client:  { label: 'Клиент',        icon: User,      color: '#a855f7', bg: 'var(--purple-soft)' },
};

// ─── Sidebar ───────────────────────────────────────────────────────────────────

const Sidebar = observer(({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const role = authStore.role as keyof typeof ROLE_PAGES | null;
  const allowed = role ? ROLE_PAGES[role] : [];
  const visibleNav = ALL_NAV.filter(item => allowed.includes(item.id));

  const mainItems      = visibleNav.filter(i => i.section === 'main');
  const analyticsItems = visibleNav.filter(i => i.section === 'analytics');
  const systemItems    = visibleNav.filter(i => i.section === 'system');

  const roleMeta = role ? ROLE_META[role as keyof typeof ROLE_META] : null;
  const RoleIcon = roleMeta?.icon;

  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const go = (path: string) => { navigate(path); onClose(); };

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">
            <Activity size={24} color="#0a0a0f" />
          </div>
          <div className="logo-text">Fit<span>Analytics</span></div>
        </div>

        {authStore.user && roleMeta && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px', borderRadius: '8px',
            background: roleMeta.bg,
            marginBottom: '6px',
            flexShrink: 0,
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '6px',
              background: roleMeta.bg, border: `1px solid ${roleMeta.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {RoleIcon && <RoleIcon size={14} color={roleMeta.color} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {authStore.user.full_name}
              </div>
              <div style={{ fontSize: '0.68rem', color: roleMeta.color }}>{roleMeta.label}</div>
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          {mainItems.length > 0 && (
            <div className="nav-section">
              <div className="nav-section-title">Основное</div>
              {mainItems.map(item => (
                <button key={item.id} className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => go(item.path)}>
                  <item.icon size={17} /><span>{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {analyticsItems.length > 0 && (
            <div className="nav-section">
              <div className="nav-section-title">Аналитика</div>
              {analyticsItems.map(item => (
                <button key={item.id} className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => go(item.path)}>
                  <item.icon size={17} /><span>{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {systemItems.length > 0 && (
            <div className="nav-section">
              <div className="nav-section-title">Система</div>
              {systemItems.map(item => (
                <button key={item.id} className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => go(item.path)}>
                  <item.icon size={17} /><span>{item.label}</span>
                </button>
              ))}
            </div>
          )}

          <div className="nav-section nav-section-bottom">
            <div className="nav-section-title">Аккаунт</div>
            <button className="nav-item" title="Помощь">
              <HelpCircle size={17} /><span>Помощь</span>
            </button>
            <button
              className="nav-item"
              style={{ color: 'var(--danger)' }}
              onClick={() => authStore.logout()}
            >
              <LogOut size={17} /><span>Выйти</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-label">ВКР Бакалавра</div>
          <div className="sidebar-footer-version">v1.0.0</div>
        </div>
      </aside>
    </>
  );
});

// ─── Mobile header ─────────────────────────────────────────────────────────────

const MobileHeader = observer(({ onMenuClick }: { onMenuClick: () => void }) => {
  const location = useLocation();
  const current = ALL_NAV.find(item =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
  );
  return (
    <header className="mobile-header">
      <button className="mobile-menu-btn" onClick={onMenuClick}>
        <Menu size={24} />
      </button>
      <div className="mobile-header-title">
        <div className="logo-icon logo-icon-sm">
          <Activity size={20} color="#0a0a0f" />
        </div>
        <span>{current?.label || 'FitAnalytics'}</span>
      </div>
    </header>
  );
});

// ─── Protected route ───────────────────────────────────────────────────────────

const ProtectedRoute = observer(({ element, pageId }: { element: React.ReactElement; pageId: string }) => {
  if (!authStore.isAuthenticated) return <Navigate to="/login" replace />;
  const role = authStore.role as keyof typeof ROLE_PAGES;
  const allowed = ROLE_PAGES[role] ?? [];
  if (!allowed.includes(pageId)) return <Navigate to="/" replace />;
  return element;
});

// ─── App layout (authenticated) ───────────────────────────────────────────────

const AppLayout = observer(() => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="app">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
      <main className="main-content">
        <Routes>
          <Route path="/"               element={<ProtectedRoute element={<Dashboard />}       pageId="dashboard" />} />
          <Route path="/clients"        element={<ProtectedRoute element={<Clients />}          pageId="clients" />} />
          <Route path="/churn"          element={<ProtectedRoute element={<ChurnAnalytics />}   pageId="churn" />} />
          <Route path="/revenue"        element={<ProtectedRoute element={<Revenue />}          pageId="revenue" />} />
          <Route path="/programs"       element={<ProtectedRoute element={<Programs />}         pageId="programs" />} />
          <Route path="/recommendations"element={<ProtectedRoute element={<Recommendations />}  pageId="recommendations" />} />
          <Route path="/access"         element={<ProtectedRoute element={<AccessControl />}    pageId="access" />} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <ToastContainer />
    </div>
  );
});

// ─── App ───────────────────────────────────────────────────────────────────────

const App = observer(() => {
  if (!authStore.isAuthenticated) {
    return (
      <>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*"      element={<Navigate to="/login" replace />} />
        </Routes>
        <ToastContainer />
      </>
    );
  }

  return <AppLayout />;
});

export default App;
