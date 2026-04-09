import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  LayoutDashboard, Users, TrendingDown, DollarSign,
  Target, Activity, HelpCircle, Menu, Lightbulb, ShieldCheck,
  LogOut, ChevronDown, Shield, UserCheck, User,
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
  { id: 'dashboard',       label: 'Дашборд',        icon: LayoutDashboard, section: 'main' },
  { id: 'clients',         label: 'Клиенты',         icon: Users,           section: 'main' },
  { id: 'churn',           label: 'Анализ оттока',   icon: TrendingDown,    section: 'analytics' },
  { id: 'revenue',         label: 'Финансы',         icon: DollarSign,      section: 'analytics' },
  { id: 'programs',        label: 'Программы',       icon: Target,          section: 'analytics' },
  { id: 'recommendations', label: 'Рекомендации',    icon: Lightbulb,       section: 'analytics' },
  { id: 'access',          label: 'Права доступа',   icon: ShieldCheck,     section: 'system' },
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

const Sidebar = observer(({ currentPage, setCurrentPage, isOpen, onClose }) => {
  const role = authStore.role as keyof typeof ROLE_PAGES | null;
  const allowed = role ? ROLE_PAGES[role] : [];
  const visibleNav = ALL_NAV.filter(item => allowed.includes(item.id));

  const mainItems     = visibleNav.filter(i => i.section === 'main');
  const analyticsItems = visibleNav.filter(i => i.section === 'analytics');
  const systemItems   = visibleNav.filter(i => i.section === 'system');

  const roleMeta = role ? ROLE_META[role] : null;
  const RoleIcon = roleMeta?.icon;

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

        {/* Current user */}
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
                <button key={item.id} className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                  onClick={() => { setCurrentPage(item.id); onClose(); }}>
                  <item.icon size={17} /><span>{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {analyticsItems.length > 0 && (
            <div className="nav-section">
              <div className="nav-section-title">Аналитика</div>
              {analyticsItems.map(item => (
                <button key={item.id} className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                  onClick={() => { setCurrentPage(item.id); onClose(); }}>
                  <item.icon size={17} /><span>{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {systemItems.length > 0 && (
            <div className="nav-section">
              <div className="nav-section-title">Система</div>
              {systemItems.map(item => (
                <button key={item.id} className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                  onClick={() => { setCurrentPage(item.id); onClose(); }}>
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

const MobileHeader = observer(({ onMenuClick, currentPage }) => {
  const allItems = [...ALL_NAV];
  const current = allItems.find(item => item.id === currentPage);
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

// ─── App ───────────────────────────────────────────────────────────────────────

const App = observer(() => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!authStore.isAuthenticated) {
    return (
      <>
        <Login />
        <ToastContainer />
      </>
    );
  }

  // Guard: if current page is not allowed for this role, redirect to dashboard
  const role = authStore.role as keyof typeof ROLE_PAGES;
  const allowed = ROLE_PAGES[role] ?? [];
  const safePage = allowed.includes(currentPage) ? currentPage : 'dashboard';

  const renderPage = () => {
    switch (safePage) {
      case 'dashboard':       return <Dashboard />;
      case 'clients':         return <Clients />;
      case 'churn':           return <ChurnAnalytics />;
      case 'revenue':         return <Revenue />;
      case 'programs':        return <Programs />;
      case 'recommendations': return <Recommendations />;
      case 'access':          return <AccessControl />;
      default:                return <Dashboard />;
    }
  };

  return (
    <div className="app">
      <Sidebar
        currentPage={safePage}
        setCurrentPage={setCurrentPage}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <MobileHeader
        onMenuClick={() => setSidebarOpen(true)}
        currentPage={safePage}
      />
      <main className="main-content">
        {renderPage()}
      </main>
      <ToastContainer />
    </div>
  );
});

export default App;
