import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import {
  Users, Search, Plus, X, Mail, Phone,
  TrendingUp, TrendingDown, AlertTriangle, ChevronRight
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { clientsStore } from '../stores';
import {
  formatNumber, formatCurrency, formatDate,
  subscriptionLabels, goalLabels, riskLabels
} from '../utils/format';

// ─── Client list item ──────────────────────────────────────────────────────────

const ClientCard = observer(({ client }) => (
  <div className="client-list-item" onClick={() => clientsStore.selectClient(client.id)}>
    <div className="avatar">{client.name.charAt(0)}</div>
    <div className="client-info">
      <div className="client-name">{client.name}</div>
      <div className="client-meta">
        {subscriptionLabels[client.subscription_type] || client.subscription_type} • {formatCurrency(client.subscription_price)}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span className={`badge ${client.is_active ? 'success' : 'danger'}`}>
        {client.is_active ? 'Активен' : 'Неактивен'}
      </span>
      <ChevronRight size={20} color="var(--text-muted)" />
    </div>
  </div>
));

// ─── Client details panel ──────────────────────────────────────────────────────

const ClientDetails = observer(() => {
  if (clientsStore.isLoadingAnalytics) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  const analytics = clientsStore.clientAnalytics;
  if (!analytics) return null;

  const { client, session_stats, monthly_visits, metrics_history,
          progress_analysis, churn_risk, upsell_potential, current_program } = analytics;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div className="avatar" style={{ width: '80px', height: '80px', fontSize: '2rem' }}>{client.name.charAt(0)}</div>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px' }}>{client.name}</h2>
            <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={16} /> {client.email}</span>
              {client.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={16} /> {client.phone}</span>}
            </div>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => clientsStore.selectClient(null)}>
          <X size={20} /> Закрыть
        </button>
      </div>

      <div className="grid-4" style={{ marginBottom: '32px' }}>
        <div className="metric-card">
          <div className="metric-value text-success">{subscriptionLabels[client.subscription_type]}</div>
          <div className="metric-label">Тип подписки</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{formatCurrency(client.subscription_price)}</div>
          <div className="metric-label">Стоимость</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{formatNumber(session_stats?.total_sessions || 0)}</div>
          <div className="metric-label">Всего тренировок</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{formatNumber(analytics.visits_per_week, 1)}</div>
          <div className="metric-label">Тренировок в неделю</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '32px' }}>
        {/* Churn risk */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <AlertTriangle size={24} color={churn_risk?.level === 'high' ? '#ff4757' : churn_risk?.level === 'medium' ? '#ffc107' : '#00d4aa'} />
            <h3 style={{ fontWeight: 600 }}>Риск оттока</h3>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="risk-indicator">
                <span className={`risk-dot ${churn_risk?.level}`} />
                <span>{riskLabels[churn_risk?.level] || 'Неизвестно'}</span>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{churn_risk?.score || 0}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${churn_risk?.score || 0}%`, background: churn_risk?.level === 'high' ? '#ff4757' : churn_risk?.level === 'medium' ? '#ffc107' : '#00d4aa' }} />
            </div>
          </div>
          {churn_risk?.factors?.length > 0 && (
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Факторы риска:</p>
              <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {churn_risk.factors.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Upsell */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <TrendingUp size={24} color="#00d4aa" />
            <h3 style={{ fontWeight: 600 }}>Потенциал апсейла</h3>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Оценка потенциала</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{upsell_potential?.score || 0}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${upsell_potential?.score || 0}%` }} />
            </div>
          </div>
          {upsell_potential?.opportunities?.length > 0 && (
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Возможности:</p>
              {upsell_potential.opportunities.map((opp, i) => (
                <div key={i} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{opp.title}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{opp.description}</div>
                  <div style={{ color: 'var(--success)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>+{formatCurrency(opp.additional_revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '32px' }}>
        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: '24px' }}>История посещений</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={(toJS(monthly_visits) || []).reverse()}>
              <defs>
                <linearGradient id="colorVisitsClient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5c7cfa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#5c7cfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 11 }} />
              <YAxis stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="visits" stroke="#5c7cfa" strokeWidth={2} fillOpacity={1} fill="url(#colorVisitsClient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {metrics_history?.length > 0 && (
          <div className="chart-card">
            <h3 className="card-title" style={{ marginBottom: '24px' }}>Динамика веса</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={toJS(metrics_history) || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="measurement_date" stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 11 }} tickFormatter={(v) => formatDate(v).slice(0, 6)} />
                <YAxis stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} formatter={(v) => [`${v} кг`, 'Вес']} />
                <Line type="monotone" dataKey="weight" stroke="#00d4aa" strokeWidth={2} dot={{ fill: '#00d4aa', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {progress_analysis?.status !== 'insufficient_data' && (
        <div className="card" style={{ marginBottom: '32px' }}>
          <h3 style={{ fontWeight: 600, marginBottom: '16px' }}>Анализ прогресса</h3>
          {progress_analysis?.insights?.map((insight, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: insight.type === 'positive' ? 'var(--success-soft)' : 'var(--warning-soft)', borderRadius: '8px', marginBottom: '8px' }}>
              {insight.type === 'positive' ? <TrendingUp size={20} color="#00d4aa" /> : <TrendingDown size={20} color="#ffc107" />}
              <span>{insight.message}</span>
            </div>
          ))}
        </div>
      )}

      {current_program && (
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: '16px' }}>Текущая программа</h3>
          <div className="grid-3">
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Название</div>
              <div style={{ fontWeight: 600 }}>{current_program.name}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Тренер</div>
              <div style={{ fontWeight: 600 }}>{current_program.trainer_name || '—'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Длительность</div>
              <div style={{ fontWeight: 600 }}>{current_program.duration_weeks} недель</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Add client modal ──────────────────────────────────────────────────────────

const AddClientModal = ({ onClose }) => {
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '',
    subscription_type: 'basic', subscription_price: 3000,
    fitness_goal: 'general_fitness', fitness_level: 'beginner',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await clientsStore.addClient(formData);
      onClose();
    } catch {
      // error shown via toastStore
    }
  };

  const set = (key) => (e) => setFormData({ ...formData, [key]: e.target.value });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Новый клиент</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Имя *</label>
            <input type="text" className="form-input" value={formData.name} onChange={set('name')} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input type="email" className="form-input" value={formData.email} onChange={set('email')} required />
          </div>
          <div className="form-group">
            <label className="form-label">Телефон</label>
            <input type="tel" className="form-input" value={formData.phone} onChange={set('phone')} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Тип подписки</label>
              <select className="form-input" value={formData.subscription_type} onChange={set('subscription_type')}>
                <option value="basic">Базовый</option>
                <option value="standard">Стандарт</option>
                <option value="premium">Премиум</option>
                <option value="vip">VIP</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Стоимость (₽)</label>
              <input type="number" className="form-input" value={formData.subscription_price} onChange={(e) => setFormData({ ...formData, subscription_price: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Цель</label>
              <select className="form-input" value={formData.fitness_goal} onChange={set('fitness_goal')}>
                <option value="weight_loss">Похудение</option>
                <option value="muscle_gain">Набор массы</option>
                <option value="endurance">Выносливость</option>
                <option value="flexibility">Гибкость</option>
                <option value="general_fitness">Общая форма</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Уровень</label>
              <select className="form-input" value={formData.fitness_level} onChange={set('fitness_level')}>
                <option value="beginner">Новичок</option>
                <option value="intermediate">Средний</option>
                <option value="advanced">Продвинутый</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary">Добавить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Clients page ─────────────────────────────────────────────────────────

const Clients = observer(() => {
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => { clientsStore.loadClients(); }, []);

  if (clientsStore.selectedClientId !== null) {
    return <ClientDetails />;
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Клиенты</h1>
            <p className="page-subtitle">Всего: {clientsStore.total} клиентов</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={20} /> Добавить клиента
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Поиск по имени или email..."
            value={clientsStore.search}
            onChange={(e) => clientsStore.setSearch(e.target.value)}
            style={{ paddingLeft: '48px' }}
          />
        </div>
        <div className="tabs" style={{ marginBottom: 0, border: 'none', padding: 0 }}>
          {(['all', 'active', 'inactive'] ).map(f => (
            <button key={f} className={`tab ${clientsStore.filter === f ? 'active' : ''}`} onClick={() => clientsStore.setFilter(f)}>
              {f === 'all' ? 'Все' : f === 'active' ? 'Активные' : 'Неактивные'}
            </button>
          ))}
        </div>
      </div>

      {clientsStore.isLoading && clientsStore.clients.length === 0 ? (
        <div className="loading"><div className="spinner" /></div>
      ) : clientsStore.clients.length === 0 ? (
        <div className="empty-state">
          <Users size={64} />
          <h3>Клиенты не найдены</h3>
          <p>Попробуйте изменить параметры поиска</p>
        </div>
      ) : (
        <div>{clientsStore.clients.map(c => <ClientCard key={c.id} client={c} />)}</div>
      )}

      {showAddModal && <AddClientModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
});

export default Clients;
