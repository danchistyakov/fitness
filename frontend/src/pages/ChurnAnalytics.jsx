import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import {
  AlertTriangle, TrendingDown, Users,
  Phone, Mail, RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { analyticsStore } from '../stores';
import { formatNumber, formatDate, subscriptionLabels, riskLabels } from '../utils/format';

const COLORS = ['#00d4aa', '#ffc107', '#ff4757'];

const ChurnAnalytics = observer(() => {
  useEffect(() => { analyticsStore.loadChurn(); }, []);

  if (analyticsStore.isLoadingChurn && !analyticsStore.churnData) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  const data = analyticsStore.churnData;
  const riskDistData = data?.risk_distribution ? [
    { name: 'Низкий',  value: data.risk_distribution.low,    color: '#00d4aa' },
    { name: 'Средний', value: data.risk_distribution.medium, color: '#ffc107' },
    { name: 'Высокий', value: data.risk_distribution.high,   color: '#ff4757' },
  ] : [];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Анализ оттока</h1>
            <p className="page-subtitle">Предиктивная аналитика и управление удержанием клиентов</p>
          </div>
          <button className="btn btn-secondary" onClick={() => analyticsStore.loadChurn()}>
            <RefreshCw size={18} /> Обновить
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card stat-card danger">
          <div className="stat-icon danger"><AlertTriangle size={24} color="#ff4757" /></div>
          <div className="card-value">{data?.risk_distribution?.high || 0}</div>
          <div className="card-title">Высокий риск оттока</div>
        </div>
        <div className="card stat-card warning">
          <div className="stat-icon warning"><TrendingDown size={24} color="#ffc107" /></div>
          <div className="card-value">{data?.risk_distribution?.medium || 0}</div>
          <div className="card-title">Средний риск</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon"><Users size={24} color="#00d4aa" /></div>
          <div className="card-value">{data?.churned_total || 0}</div>
          <div className="card-title">Всего ушло клиентов</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: '24px' }}>Динамика оттока по месяцам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={(toJS(data?.churn_by_month) || []).reverse()}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 12 }} />
              <YAxis stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} formatter={(v, n) => [v, n === 'churned' ? 'Ушло' : 'Всего']} />
              <Bar dataKey="total"   name="Всего" fill="#5c7cfa" radius={[4, 4, 0, 0]} />
              <Bar dataKey="churned" name="Ушло"  fill="#ff4757" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: '24px' }}>Распределение по риску</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={riskDistData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={{ stroke: '#6b6b7b' }}>
                {riskDistData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontWeight: 600 }}>Клиенты с высоким риском оттока</h3>
          <span className="badge danger">{data?.at_risk_clients?.length || 0} клиентов</span>
        </div>

        {!data?.at_risk_clients?.length ? (
          <div className="empty-state">
            <Users size={48} />
            <p>Нет клиентов с высоким риском оттока</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Клиент</th><th>Подписка</th><th>Последний визит</th>
                  <th>Тренировок</th><th>Риск</th><th>Факторы</th><th></th>
                </tr>
              </thead>
              <tbody>
                {data.at_risk_clients.map((item, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="avatar" style={{ width: '36px', height: '36px', fontSize: '0.85rem' }}>{item.client.name.charAt(0)}</div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.client.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.client.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge info">{subscriptionLabels[item.client.subscription_type]}</span></td>
                    <td>{item.last_visit ? formatDate(item.last_visit) : 'Никогда'}</td>
                    <td>{item.total_sessions}</td>
                    <td>
                      <div className="risk-indicator">
                        <span className={`risk-dot ${item.risk.level}`} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.risk.score}%</span>
                      </div>
                    </td>
                    <td><div style={{ maxWidth: '200px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.risk.factors?.slice(0, 2).join(', ')}</div></td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-ghost" style={{ padding: '8px' }} title="Позвонить"><Phone size={16} /></button>
                        <button className="btn btn-ghost" style={{ padding: '8px' }} title="Написать"><Mail size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h3 style={{ fontWeight: 600, marginBottom: '24px' }}>Рекомендации по удержанию</h3>
        <div className="grid-2">
          <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', borderLeft: '4px solid var(--danger)' }}>
            <h4 style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--danger)' }}>Срочные действия</h4>
            <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <li>Связаться с клиентами, не посещавшими зал более 2 недель</li>
              <li>Предложить бесплатную персональную тренировку</li>
              <li>Рассмотреть индивидуальные скидки для возврата</li>
            </ul>
          </div>
          <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', borderLeft: '4px solid var(--warning)' }}>
            <h4 style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--warning)' }}>Профилактика</h4>
            <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <li>Внедрить систему напоминаний о тренировках</li>
              <li>Проводить регулярные опросы удовлетворённости</li>
              <li>Создать программу лояльности для постоянных клиентов</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ChurnAnalytics;
