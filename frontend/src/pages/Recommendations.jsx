import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Lightbulb, TrendingUp, Users, BarChart2,
  AlertTriangle, RefreshCw, ArrowUpRight, CheckCircle
} from 'lucide-react';
import { analyticsStore } from '../stores';
import { formatCurrency } from '../utils/format';

const TYPE_META = {
  upsell_opportunity: {
    label: 'Апсейл',
    icon: TrendingUp,
    color: '#a855f7',
    bg: 'var(--purple-soft)',
    border: 'var(--purple)',
  },
  retention: {
    label: 'Удержание',
    icon: Users,
    color: '#ff4757',
    bg: 'var(--danger-soft)',
    border: 'var(--danger)',
  },
  trainer_optimization: {
    label: 'Оптимизация тренеров',
    icon: BarChart2,
    color: '#5c7cfa',
    bg: 'var(--info-soft)',
    border: 'var(--info)',
  },
  capacity_optimization: {
    label: 'Загрузка зала',
    icon: AlertTriangle,
    color: '#ffc107',
    bg: 'var(--warning-soft)',
    border: 'var(--warning)',
  },
};

const PRIORITY_META = {
  high:   { label: 'Высокий', className: 'badge danger' },
  medium: { label: 'Средний', className: 'badge warning' },
  low:    { label: 'Низкий',  className: 'badge success' },
};

const RecommendationCard = ({ rec }) => {
  const meta = TYPE_META[rec.type] || { label: rec.type, icon: Lightbulb, color: '#00d4aa', bg: 'var(--success-soft)', border: 'var(--accent-primary)' };
  const Icon = meta.icon;
  const priority = PRIORITY_META[rec.priority] || { label: rec.priority, className: 'badge' };

  return (
    <div className="card" style={{ borderLeft: `4px solid ${meta.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={22} color={meta.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>{rec.title}</span>
            <span className={priority.className}>{priority.label} приоритет</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{meta.label}</span>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00d4aa' }}>
            <ArrowUpRight size={16} />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem' }}>{formatCurrency(rec.potential_impact)}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>потенциал/мес.</div>
        </div>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{rec.description}</p>
    </div>
  );
};

const Recommendations = observer(() => {
  useEffect(() => { analyticsStore.loadRecommendations(); }, []);

  if (analyticsStore.isLoadingRecommendations && !analyticsStore.recommendationsData) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  const data = analyticsStore.recommendationsData;
  const recs = data?.recommendations || [];
  const highCount = recs.filter(r => r.priority === 'high').length;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Рекомендации</h1>
            <p className="page-subtitle">Управленческие рекомендации, сформированные системой на основе аналитики</p>
          </div>
          <button className="btn btn-secondary" onClick={() => analyticsStore.loadRecommendations(true)}>
            <RefreshCw size={18} /> Обновить
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card stat-card">
          <div className="stat-icon"><Lightbulb size={24} color="#00d4aa" /></div>
          <div className="card-value">{recs.length}</div>
          <div className="card-title">Рекомендаций всего</div>
        </div>
        <div className="card stat-card danger">
          <div className="stat-icon danger"><AlertTriangle size={24} color="#ff4757" /></div>
          <div className="card-value">{highCount}</div>
          <div className="card-title">Высокого приоритета</div>
        </div>
        <div className="card stat-card purple">
          <div className="stat-icon purple"><TrendingUp size={24} color="#a855f7" /></div>
          <div className="card-value">{formatCurrency(data?.total_potential_impact || 0)}</div>
          <div className="card-title">Суммарный потенциал</div>
        </div>
      </div>

      {recs.length === 0 ? (
        <div className="card" style={{ marginTop: '24px' }}>
          <div className="empty-state">
            <CheckCircle size={48} color="#00d4aa" />
            <p>Всё в порядке — новых рекомендаций нет</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
          {recs.map((rec, i) => <RecommendationCard key={i} rec={rec} />)}
        </div>
      )}

      {recs.length > 0 && (
        <div className="card" style={{ marginTop: '24px', background: 'var(--success-soft)', border: '1px solid rgba(0,212,170,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TrendingUp size={24} color="#00d4aa" />
            <span style={{ fontWeight: 600 }}>Суммарный потенциальный эффект от всех рекомендаций</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.4rem', color: '#00d4aa' }}>
            {formatCurrency(data?.total_potential_impact || 0)}
            <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px' }}>/ мес.</span>
          </span>
        </div>
      )}
    </div>
  );
});

export default Recommendations;
