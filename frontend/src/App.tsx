import React, { useState } from 'react';
import {
  LayoutDashboard, Users, TrendingDown, DollarSign,
  Target, Activity, Settings, HelpCircle
} from 'lucide-react';
import './styles/globals.css';

import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ChurnAnalytics from './pages/ChurnAnalytics';
import Revenue from './pages/Revenue';
import Programs from './pages/Programs';

const navItems = [
  { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { id: 'clients', label: 'Клиенты', icon: Users },
  { id: 'churn', label: 'Анализ оттока', icon: TrendingDown },
  { id: 'revenue', label: 'Финансы', icon: DollarSign },
  { id: 'programs', label: 'Программы', icon: Target },
];

const Sidebar = ({ currentPage, setCurrentPage }) => (
  <aside className="sidebar">
    <div className="sidebar-logo">
      <div className="logo-icon">
        <Activity size={24} color="#0a0a0f" />
      </div>
      <div className="logo-text">
        Fit<span>Analytics</span>
      </div>
    </div>

    <nav className="sidebar-nav">
      <div className="nav-section">
        <div className="nav-section-title">Основное</div>
        {navItems.slice(0, 2).map(item => (
          <button
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => setCurrentPage(item.id)}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="nav-section">
        <div className="nav-section-title">Аналитика</div>
        {navItems.slice(2).map(item => (
          <button
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => setCurrentPage(item.id)}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div className="nav-section-title">Система</div>
        <button className="nav-item">
          <Settings size={20} />
          <span>Настройки</span>
        </button>
        <button className="nav-item">
          <HelpCircle size={20} />
          <span>Помощь</span>
        </button>
      </div>
    </nav>

    <div style={{
      padding: '16px',
      background: 'var(--bg-card)',
      borderRadius: '12px',
      marginTop: '16px'
    }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
        Версия системы
      </div>
      <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
        v1.0.0
      </div>
    </div>
  </aside>
);

const App = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'clients':
        return <Clients />;
      case 'churn':
        return <ChurnAnalytics />;
      case 'revenue':
        return <Revenue />;
      case 'programs':
        return <Programs />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;