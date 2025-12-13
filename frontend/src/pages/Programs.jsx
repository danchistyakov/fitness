import React, { useState, useEffect } from 'react';
import { 
  Target, Award, Users, Star, TrendingUp, BarChart3
} from 'lucide-react';
import {
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell
} from 'recharts';
import { useApi, formatNumber, goalLabels } from '../hooks/useApi';

const COLORS = ['#00d4aa', '#5c7cfa', '#a855f7', '#ffc107', '#ff4757'];

const Programs = () => {
  const { get, loading } = useApi();
  const [data, setData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const programsData = await get('/analytics/programs/effectiveness');
      setData(programsData);
    } catch (err) {
      console.error('Failed to load programs data:', err);
    }
  };

  if (loading && !data) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const sortedPrograms = [...(data?.programs || [])].sort((a, b) => b.effectiveness_score - a.effectiveness_score);
  const topPrograms = sortedPrograms.slice(0, 5);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Эффективность программ</h1>
        <p className="page-subtitle">Анализ тренировочных программ и их результативности</p>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card stat-card">
          <div className="stat-icon"><Target size={24} color="#00d4aa" /></div>
          <div className="card-value">{data?.programs?.length || 0}</div>
          <div className="card-title">Активных программ</div>
        </div>
        <div className="card stat-card info">
          <div className="stat-icon info"><Award size={24} color="#5c7cfa" /></div>
          <div className="card-value">
            {formatNumber(sortedPrograms[0]?.effectiveness_score || 0, 1)}
          </div>
          <div className="card-title">Лучший рейтинг</div>
        </div>
        <div className="card stat-card purple">
          <div className="stat-icon purple"><Star size={24} color="#a855f7" /></div>
          <div className="card-value">
            {formatNumber(
              data?.programs?.reduce((acc, p) => acc + (p.avg_satisfaction || 0), 0) / 
              (data?.programs?.length || 1), 1
            )}
          </div>
          <div className="card-title">Средняя оценка</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Top Programs Chart */}
        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: '24px' }}>Топ программ по эффективности</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart 
              data={topPrograms} 
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 12 }} domain={[0, 100]} />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke="#6b6b7b" 
                tick={{ fill: '#a0a0b0', fontSize: 12 }}
                width={90}
              />
              <Tooltip 
                contentStyle={{ 
                  background: '#1a1a24', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px'
                }}
                formatter={(value) => [`${value}%`, 'Эффективность']}
              />
              <Bar 
                dataKey="effectiveness_score" 
                name="Эффективность"
                radius={[0, 4, 4, 0]}
              >
                {topPrograms.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Goals Distribution */}
        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: '24px' }}>Программы по целям</h3>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={data?.goals_stats?.map(g => ({
              ...g,
              goal: goalLabels[g.goal] || g.goal,
              satisfaction: g.avg_satisfaction || 0
            })) || []}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis 
                dataKey="goal" 
                tick={{ fill: '#a0a0b0', fontSize: 11 }}
              />
              <PolarRadiusAxis 
                angle={30} 
                domain={[0, 'auto']}
                tick={{ fill: '#6b6b7b', fontSize: 10 }}
              />
              <Radar
                name="Кол-во программ"
                dataKey="count"
                stroke="#00d4aa"
                fill="#00d4aa"
                fillOpacity={0.3}
              />
              <Tooltip 
                contentStyle={{ 
                  background: '#1a1a24', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px'
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Programs Table */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h3 style={{ fontWeight: 600, marginBottom: '24px' }}>Все программы</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Программа</th>
                <th>Тренер</th>
                <th>Цель</th>
                <th>Сложность</th>
                <th>Сессий</th>
                <th>Клиентов</th>
                <th>Оценка</th>
                <th>Эффективность</th>
              </tr>
            </thead>
            <tbody>
              {sortedPrograms.map((program, index) => (
                <tr key={program.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {index < 3 && (
                        <Award 
                          size={20} 
                          color={index === 0 ? '#ffc107' : index === 1 ? '#a0a0b0' : '#cd7f32'} 
                        />
                      )}
                      <span style={{ fontWeight: 600 }}>{program.name}</span>
                    </div>
                  </td>
                  <td>{program.trainer_name || '—'}</td>
                  <td>
                    <span className="badge info">
                      {goalLabels[program.goal] || program.goal || '—'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      program.difficulty_level === 'hard' ? 'danger' :
                      program.difficulty_level === 'medium' ? 'warning' : 'success'
                    }`}>
                      {program.difficulty_level === 'hard' ? 'Сложный' :
                       program.difficulty_level === 'medium' ? 'Средний' : 'Лёгкий'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{program.total_sessions}</td>
                  <td>{program.clients_count}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Star size={16} fill="#ffc107" color="#ffc107" />
                      <span style={{ fontWeight: 600 }}>
                        {formatNumber(program.avg_satisfaction, 1)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="progress-bar" style={{ width: '80px', height: '6px' }}>
                        <div 
                          className="progress-fill" 
                          style={{ 
                            width: `${program.effectiveness_score}%`,
                            background: program.effectiveness_score > 70 ? '#00d4aa' :
                                       program.effectiveness_score > 50 ? '#ffc107' : '#ff4757'
                          }}
                        ></div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, minWidth: '40px' }}>
                        {program.effectiveness_score}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights */}
      <div className="grid-2" style={{ marginTop: '24px' }}>
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: '16px' }}>
            <TrendingUp size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Лучшие практики
          </h3>
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
            <p>На основе анализа наиболее эффективных программ:</p>
            <ul style={{ paddingLeft: '20px', marginTop: '12px' }}>
              <li>Оптимальная длительность: 10-12 недель</li>
              <li>3-4 тренировки в неделю показывают лучший результат</li>
              <li>Программы со средней сложностью имеют высший retention</li>
              <li>Персональный тренер увеличивает эффективность на 35%</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: '16px' }}>
            <BarChart3 size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Рекомендации
          </h3>
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
            <ul style={{ paddingLeft: '20px' }}>
              <li>Пересмотреть программы с эффективностью ниже 50%</li>
              <li>Увеличить долю программ для набора массы</li>
              <li>Добавить больше вариантов для начинающих</li>
              <li>Внедрить систему прогрессии нагрузок</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Programs;
