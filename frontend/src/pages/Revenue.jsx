import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, CreditCard, Calendar,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useApi, formatCurrency } from '../hooks/useApi';

const COLORS = ['#00d4aa', '#5c7cfa', '#a855f7', '#ffc107', '#ff4757'];

const Revenue = () => {
  const { get, loading } = useApi();
  const [data, setData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const revenueData = await get('/analytics/revenue');
      setData(revenueData);
    } catch (err) {
      console.error('Failed to load revenue data:', err);
    }
  };

  if (loading && !data) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const currentRevenue = data?.monthly_revenue?.[0]?.revenue || 0;
  const prevRevenue = data?.monthly_revenue?.[1]?.revenue || 0;
  const revenueGrowth = prevRevenue > 0 
    ? ((currentRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) 
    : 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Финансовая аналитика</h1>
        <p className="page-subtitle">Анализ выручки и финансовых показателей</p>
      </div>

      <div className="stats-grid">
        <div className="card stat-card info">
          <div className="stat-icon info"><DollarSign size={24} color="#5c7cfa" /></div>
          <div className="card-value">{formatCurrency(currentRevenue)}</div>
          <div className="card-title">Выручка за месяц</div>
          <div className={`stat-change ${Number(revenueGrowth) >= 0 ? 'positive' : 'negative'}`}>
            {Number(revenueGrowth) >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            {Math.abs(revenueGrowth)}%
          </div>
        </div>
        <div className="card stat-card purple">
          <div className="stat-icon purple"><CreditCard size={24} color="#a855f7" /></div>
          <div className="card-value">{formatCurrency(data?.arpu || 0)}</div>
          <div className="card-title">ARPU (30 дней)</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon"><TrendingUp size={24} color="#00d4aa" /></div>
          <div className="card-value">{formatCurrency(data?.forecast_next_month || 0)}</div>
          <div className="card-title">Прогноз</div>
        </div>
        <div className="card stat-card warning">
          <div className="stat-icon warning"><Calendar size={24} color="#ffc107" /></div>
          <div className="card-value">{formatCurrency(data?.avg_check_trend?.[0]?.avg_check || 0)}</div>
          <div className="card-title">Средний чек</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: '24px' }}>Динамика выручки</h3>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={data?.monthly_revenue?.slice().reverse() || []}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5c7cfa" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#5c7cfa" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 12 }} />
              <YAxis stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 12 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} formatter={(v) => [formatCurrency(v), 'Выручка']} />
              <Area type="monotone" dataKey="revenue" stroke="#5c7cfa" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: '24px' }}>По подпискам</h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie data={data?.revenue_by_type || []} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="revenue" nameKey="type" label={({ type, revenue }) => `${type}: ${formatCurrency(revenue)}`} labelLine={{ stroke: '#6b6b7b' }}>
                {(data?.revenue_by_type || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} formatter={(v) => [formatCurrency(v), 'Выручка']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-card" style={{ marginTop: '24px' }}>
        <h3 className="card-title" style={{ marginBottom: '24px' }}>Динамика среднего чека</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data?.avg_check_trend?.slice().reverse() || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 12 }} />
            <YAxis stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 12 }} tickFormatter={(v) => `${(v/1000).toFixed(1)}k`} />
            <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} formatter={(v) => [formatCurrency(v), 'Средний чек']} />
            <Bar dataKey="avg_check" name="Средний чек" fill="#a855f7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h3 style={{ fontWeight: 600, marginBottom: '24px' }}>Детализация по месяцам</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Месяц</th>
                <th>Выручка</th>
                <th>Транзакций</th>
                <th>Средний чек</th>
                <th>Изменение</th>
              </tr>
            </thead>
            <tbody>
              {data?.monthly_revenue?.map((item, index) => {
                const prevItem = data.monthly_revenue[index + 1];
                const change = prevItem ? ((item.revenue - prevItem.revenue) / prevItem.revenue * 100).toFixed(1) : 0;
                return (
                  <tr key={item.month}>
                    <td style={{ fontWeight: 600 }}>{item.month}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(item.revenue)}</td>
                    <td>{item.transactions}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(item.revenue / item.transactions)}</td>
                    <td>
                      {prevItem && (
                        <span className={`stat-change ${Number(change) >= 0 ? 'positive' : 'negative'}`}>
                          {Number(change) >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {Math.abs(change)}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: '24px' }}>
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: '16px', color: 'var(--success)' }}>💡 Возможности роста</h3>
          <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: '2' }}>
            <li>Увеличить долю Premium и VIP подписок</li>
            <li>Запустить программу семейных абонементов</li>
            <li>Добавить дополнительные услуги</li>
            <li>Внедрить корпоративные программы</li>
          </ul>
        </div>
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: '16px', color: 'var(--warning)' }}>⚠️ Риски</h3>
          <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: '2' }}>
            <li>Сезонное снижение посещаемости летом</li>
            <li>Высокая доля базовых подписок</li>
            <li>Зависимость от ключевых тренеров</li>
            <li>Конкуренция онлайн-фитнеса</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Revenue;
