import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import {
  Users, TrendingUp, DollarSign, Activity,
  AlertTriangle, Star, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { dashboardStore } from '../stores';
import { formatNumber, formatCurrency } from '../utils/format';

const COLORS = ['#00d4aa', '#5c7cfa', '#a855f7', '#ffc107', '#ff4757'];

const StatCard = ({ title, value, icon: Icon, change, changeType, variant = 'default' }) => (
  <div className={`card stat-card ${variant}`}>
    <div className="card-header">
      <div className={`stat-icon ${variant}`}>
        <Icon size={24} color={
          variant === 'warning' ? '#ffc107' :
          variant === 'danger'  ? '#ff4757' :
          variant === 'info'    ? '#5c7cfa' :
          variant === 'purple'  ? '#a855f7' : '#00d4aa'
        } />
      </div>
    </div>
    <div className="card-value">{value}</div>
    <div className="card-title">{title}</div>
    {change !== undefined && (
      <div className={`stat-change ${changeType}`}>
        {changeType === 'positive' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        {change}%
      </div>
    )}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-hover)',
      borderRadius: '10px',
      padding: '10px 14px',
      boxShadow: 'var(--shadow-lg)',
      fontSize: '0.85rem',
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color, display: 'inline-block', flexShrink: 0 }} />
          {entry.name}: {formatNumber(entry.value)}
        </p>
      ))}
    </div>
  );
};

const Dashboard = observer(() => {
  useEffect(() => { dashboardStore.load(); }, []);

  if (dashboardStore.isLoading && !dashboardStore.data) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (dashboardStore.isEmpty) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Добро пожаловать в FitAnalytics</h1>
          <p className="page-subtitle">Система аналитики персонализированных тренировочных программ</p>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <Activity size={64} color="#00d4aa" style={{ marginBottom: '24px' }} />
          <h2 style={{ marginBottom: '16px' }}>Нет данных для отображения</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Сгенерируйте демонстрационные данные для изучения возможностей системы
          </p>
          <button
            className="btn btn-primary"
            onClick={() => dashboardStore.generateDemoData()}
            disabled={dashboardStore.isGenerating}
          >
            {dashboardStore.isGenerating ? 'Генерация...' : 'Сгенерировать демо-данные'}
          </button>
        </div>
      </div>
    );
  }

  const summary = dashboardStore.data?.summary || {};
  const recs = dashboardStore.recommendations;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Дашборд</h1>
        <p className="page-subtitle">Обзор ключевых показателей фитнес-центра</p>
      </div>

      <div className="stats-grid">
        <StatCard title="Активные клиенты" value={formatNumber(summary.active_clients)} icon={Users} change={summary.retention_rate} changeType="positive" />
        <StatCard title="Выручка за месяц" value={formatCurrency(summary.monthly_revenue)} icon={DollarSign} change={summary.revenue_growth} changeType={summary.revenue_growth >= 0 ? 'positive' : 'negative'} variant="info" />
        <StatCard title="Тренировок за 30 дней" value={formatNumber(summary.sessions_30d)} icon={Activity} variant="purple" />
        <StatCard title="Средняя оценка" value={formatNumber(summary.avg_satisfaction, 1)} icon={Star} variant="warning" />
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: '24px' }}>Динамика посещений</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={toJS(dashboardStore.data?.weekly_visits) || []}>
              <defs>
                <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 12 }} tickFormatter={(v) => v.split('-')[1] ? `Нед ${v.split('-')[1]}` : v} />
              <YAxis stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="visits" name="Посещения" stroke="#00d4aa" strokeWidth={2} fillOpacity={1} fill="url(#colorVisits)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: '24px' }}>Типы подписок</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={toJS(dashboardStore.data?.subscription_distribution) || []} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="count" nameKey="type" label={({ type, count }) => `${type}: ${count}`} labelLine={{ stroke: '#6b6b7b' }}>
                {(toJS(dashboardStore.data?.subscription_distribution) || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: '24px' }}>Посещения по дням недели</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={toJS(dashboardStore.data?.visits_by_weekday) || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 12 }} />
              <YAxis stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)', radius: 4 }} />
              <Bar dataKey="visits" name="Посещения" fill="#5c7cfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: '24px' }}>Топ тренеры</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(dashboardStore.data?.top_trainers || []).map((trainer, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                <div className="avatar">{trainer.name.charAt(0)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{trainer.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{trainer.sessions} сессий</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star size={16} fill="#ffc107" color="#ffc107" />
                  <span style={{ fontWeight: 600 }}>{formatNumber(trainer.rating, 1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {recs?.recommendations?.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>Рекомендации системы</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Потенциальный дополнительный доход: {formatCurrency(recs.total_potential_impact)}
          </p>
          {recs.recommendations.slice(0, 4).map((rec, i) => (
            <div key={i} className="recommendation-card">
              <div className="recommendation-icon" style={{ background: rec.priority === 'high' ? 'var(--danger-soft)' : rec.priority === 'medium' ? 'var(--warning-soft)' : 'var(--success-soft)' }}>
                {rec.priority === 'high'
                  ? <AlertTriangle size={24} color="#ff4757" />
                  : <TrendingUp size={24} color={rec.priority === 'medium' ? '#ffc107' : '#00d4aa'} />}
              </div>
              <div className="recommendation-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                  <span className="recommendation-title">{rec.title}</span>
                  <span className={`badge ${rec.priority === 'high' ? 'danger' : rec.priority === 'medium' ? 'warning' : 'success'}`}>
                    {rec.priority === 'high' ? 'Важно' : rec.priority === 'medium' ? 'Средний' : 'Низкий'}
                  </span>
                </div>
                <p className="recommendation-description">{rec.description}</p>
                <span className="recommendation-impact">+{formatCurrency(rec.potential_impact)} потенциальный доход</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default Dashboard;
