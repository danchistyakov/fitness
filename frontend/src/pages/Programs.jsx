import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { toJS } from 'mobx';
import { Target, Award, Star, TrendingUp, BarChart3 } from 'lucide-react';
import { BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { analyticsStore } from '../stores';
import { formatNumber, goalLabels } from '../utils/format';

const COLORS = ['#00d4aa', '#5c7cfa', '#a855f7', '#ffc107', '#ff4757'];

const Programs = observer(() => {
  useEffect(() => {
    analyticsStore.loadPrograms();
  }, []);

  if (analyticsStore.isLoadingPrograms && !analyticsStore.programsData) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  const data = analyticsStore.programsData;
  const sortedPrograms = (toJS(data?.programs) || []).sort((a, b) => b.effectiveness_score - a.effectiveness_score);
  const topPrograms = sortedPrograms.slice(0, 5);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Эффективность программ</h1>
        <p className="page-subtitle">Анализ тренировочных программ и их результативности</p>
      </div>

      <div className="stats-grid stats-grid-3">
        <div className="card stat-card">
          <div className="stat-icon"><Target size={24} color="#00d4aa" /></div>
          <div className="card-value">{data?.programs?.length || 0}</div>
          <div className="card-title">Активных программ</div>
        </div>
        <div className="card stat-card info">
          <div className="stat-icon info"><Award size={24} color="#5c7cfa" /></div>
          <div className="card-value">{formatNumber(sortedPrograms[0]?.effectiveness_score || 0, 1)}</div>
          <div className="card-title">Лучший рейтинг</div>
        </div>
        <div className="card stat-card purple">
          <div className="stat-icon purple"><Star size={24} color="#a855f7" /></div>
          <div className="card-value">
            {formatNumber(data?.programs?.reduce((acc, p) => acc + (p.avg_satisfaction || 0), 0) / (data?.programs?.length || 1), 1)}
          </div>
          <div className="card-title">Средняя оценка</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3 className="card-title">Топ программ по эффективности</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={topPrograms} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" stroke="#6b6b7b" tick={{ fill: '#6b6b7b', fontSize: 12 }} domain={[0, 100]} />
              <YAxis type="category" dataKey="name" stroke="#6b6b7b" tick={{ fill: '#a0a0b0', fontSize: 12 }} width={90} />
              <Tooltip formatter={(v) => [`${v}%`, 'Эффективность']} />
              <Bar dataKey="effectiveness_score" name="Эффективность" radius={[0, 4, 4, 0]}>
                {topPrograms.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3 className="card-title">Программы по целям</h3>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={(toJS(data?.goals_stats) || []).map(g => ({ ...g, goal: goalLabels[g.goal] || g.goal }))}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="goal" tick={{ fill: '#a0a0b0', fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: '#6b6b7b', fontSize: 10 }} />
              <Radar name="Кол-во программ" dataKey="count" stroke="#00d4aa" fill="#00d4aa" fillOpacity={0.3} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card mt-lg">
        <h3 className="card-title">Все программы</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Программа</th><th>Тренер</th><th>Цель</th><th>Сложность</th><th>Сессий</th><th>Клиентов</th><th>Оценка</th><th>Эффективность</th></tr>
            </thead>
            <tbody>
              {sortedPrograms.map((program, index) => (
                <tr key={program.id}>
                  <td>
                    <div className="table-program">
                      {index < 3 && <Award size={20} color={index === 0 ? '#ffc107' : index === 1 ? '#a0a0b0' : '#cd7f32'} />}
                      <span className="font-bold">{program.name}</span>
                    </div>
                  </td>
                  <td>{program.trainer_name || '—'}</td>
                  <td><span className="badge info">{goalLabels[program.goal] || program.goal || '—'}</span></td>
                  <td>
                    <span className={`badge ${program.difficulty_level === 'hard' ? 'danger' : program.difficulty_level === 'medium' ? 'warning' : 'success'}`}>
                      {program.difficulty_level === 'hard' ? 'Сложный' : program.difficulty_level === 'medium' ? 'Средний' : 'Лёгкий'}
                    </span>
                  </td>
                  <td className="font-mono">{program.total_sessions}</td>
                  <td>{program.clients_count}</td>
                  <td>
                    <div className="table-rating"><Star size={16} fill="#ffc107" color="#ffc107" /><span className="font-bold">{formatNumber(program.avg_satisfaction, 1)}</span></div>
                  </td>
                  <td>
                    <div className="table-effectiveness">
                      <div className="progress-bar progress-sm">
                        <div className="progress-fill" style={{
                          width: `${program.effectiveness_score}%`,
                          background: program.effectiveness_score > 70 ? '#00d4aa' : program.effectiveness_score > 50 ? '#ffc107' : '#ff4757'
                        }} />
                      </div>
                      <span className="font-mono font-bold">{program.effectiveness_score}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2 mt-lg">
        <div className="card">
          <h3 className="card-title"><TrendingUp size={20} /> Лучшие практики</h3>
          <ul className="insights-list">
            <li>Оптимальная длительность: 10-12 недель</li>
            <li>3-4 тренировки в неделю показывают лучший результат</li>
            <li>Программы со средней сложностью имеют высший retention</li>
            <li>Персональный тренер увеличивает эффективность на 35%</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title"><BarChart3 size={20} /> Рекомендации</h3>
          <ul className="insights-list">
            <li>Пересмотреть программы с эффективностью ниже 50%</li>
            <li>Увеличить долю программ для набора массы</li>
            <li>Добавить больше вариантов для начинающих</li>
            <li>Внедрить систему прогрессии нагрузок</li>
          </ul>
        </div>
      </div>
    </div>
  );
});

export default Programs;