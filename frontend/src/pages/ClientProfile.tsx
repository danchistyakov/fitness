import { useEffect, useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, Heart, Target as TargetIcon,
  Activity as ActivityIcon, ClipboardList, BarChart3, User as UserIcon,
  CheckCircle, Plus, TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  clientsStore, analyticsStore, goalsStore, programsStore, sessionsStore,
  authStore, trainersStore,
} from '@/stores';
import type { ClientGoalCreate, ProgramCreate } from '@/types/api';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Tabs } from '@/components/Tabs';
import { Stat } from '@/components/Stat';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Empty } from '@/components/Empty';
import { Field } from '@/components/Field';
import { Input, Select, Textarea } from '@/components/Input';
import { Combobox } from '@/components/Combobox';
import { Modal } from '@/components/Modal';
import { ScoreBreakdown } from '@/components/ScoreBreakdown';
import { DataTable, type Column } from '@/components/DataTable';
import {
  formatDate, formatNumber, riskLabels, goalLabels, levelLabels,
  subscriptionLabels, metricLabels,
} from '@/utils/format';
import type { Session, ClientGoal, Program, ProgramAnalytics } from '@/types/api';
import s from './ClientProfile.module.scss';

type TabId = 'profile' | 'goals' | 'metrics' | 'programs' | 'sessions' | 'analytics' | 'program-results';

const TABS = [
  { id: 'profile' as TabId,   label: 'Профиль',   icon: <UserIcon size={14} /> },
  { id: 'goals' as TabId,     label: 'Цели',      icon: <TargetIcon size={14} /> },
  { id: 'metrics' as TabId,   label: 'Метрики',   icon: <Heart size={14} /> },
  { id: 'programs' as TabId,  label: 'Программы', icon: <ClipboardList size={14} /> },
  { id: 'program-results' as TabId, label: 'Результаты программ', icon: <TrendingUp size={14} /> },
  { id: 'sessions' as TabId,  label: 'Сессии',    icon: <ActivityIcon size={14} /> },
  { id: 'analytics' as TabId, label: 'Аналитика', icon: <BarChart3 size={14} /> },
];

const ClientProfile = observer(() => {
  const { id } = useParams<{ id: string }>();
  const clientId = id ? Number(id) : NaN;
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('profile');

  useEffect(() => {
    if (Number.isNaN(clientId)) return;
    analyticsStore.loadClient(clientId);
  }, [clientId]);

  if (Number.isNaN(clientId)) {
    return (
      <Page title="Клиент"><Empty title="Некорректный идентификатор" /></Page>
    );
  }

  const client = analyticsStore.clientAnalytics?.client;
  if (!client) {
    return (
      <Page title="Загрузка…" actions={
        <Button variant="ghost" iconLeft={<ArrowLeft size={14} />} onClick={() => navigate('/clients')}>
          К списку
        </Button>
      }>
        <Card><div style={{ height: 200 }} /></Card>
      </Page>
    );
  }

  return (
    <Page
      title={client.name}
      subtitle={client.email}
      actions={
        <Button variant="ghost" iconLeft={<ArrowLeft size={14} />} onClick={() => navigate('/clients')}>
          К списку
        </Button>
      }
    >
      {client.contraindications && (
        <div className={s.warnBanner}>
          <AlertTriangle size={16} />
          <div>
            <strong>Противопоказания:</strong> {client.contraindications}
          </div>
        </div>
      )}

      <Tabs items={TABS} active={tab} onChange={(id) => setTab(id as TabId)} />

      {tab === 'profile' && <ProfileTab />}
      {tab === 'goals' && <GoalsTab clientId={clientId} />}
      {tab === 'metrics' && <MetricsTab />}
      {tab === 'programs' && <ProgramsTab clientId={clientId} />}
      {tab === 'program-results' && <ProgramResultsTab />}
      {tab === 'sessions' && <SessionsTab clientId={clientId} />}
      {tab === 'analytics' && <AnalyticsTab />}
    </Page>
  );
});

const ProfileTab = observer(() => {
  const c = analyticsStore.clientAnalytics?.client;
  if (!c) return null;

  return (
    <div className={s.grid}>
      <Card title="Основная информация">
        <dl className={s.dl}>
          <Item k="Email" v={c.email} />
          <Item k="Телефон" v={c.phone || '—'} />
          <Item k="Дата рождения" v={formatDate(c.birth_date)} />
          <Item k="Пол" v={c.gender === 'male' ? 'Мужской' : c.gender === 'female' ? 'Женский' : '—'} />
        </dl>
      </Card>

      <Card title="Абонемент и подготовка">
        <dl className={s.dl}>
          <Item k="Тип" v={
            <Badge variant={c.subscription_type === 'vip' ? 'purple' : 'info'}>
              {subscriptionLabels[c.subscription_type] ?? c.subscription_type}
            </Badge>
          } />
          <Item k="Начало" v={formatDate(c.subscription_start_date)} />
          <Item k="Регистрация" v={formatDate(c.registration_date)} />
          <Item k="Уровень" v={levelLabels[c.fitness_level] ?? c.fitness_level} />
          <Item k="Цель" v={c.fitness_goal ? (goalLabels[c.fitness_goal] ?? c.fitness_goal) : '—'} />
          <Item k="Статус" v={
            c.is_active
              ? <Badge variant="success">Активный</Badge>
              : <Badge variant="neutral">Деактивирован</Badge>
          } />
        </dl>
      </Card>

      {c.health_notes && (
        <Card title="Медицинские заметки" className={s.fullSpan}>
          <p className={s.healthText}>{c.health_notes}</p>
        </Card>
      )}
    </div>
  );
});

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className={s.dt}>{k}</dt>
      <dd className={s.dd}>{v}</dd>
    </>
  );
}

const GoalsTab = observer(({ clientId }: { clientId: number }) => {
  const [creating, setCreating] = useState(false);
  const goals = analyticsStore.clientAnalytics?.goals ?? [];

  return (
    <Card
      title="Цели клиента"
      subtitle="Привязка к измерениям и прогресс к целевым значениям"
      actions={
        <Button size="sm" iconLeft={<Plus size={12} />} onClick={() => setCreating(true)}>
          Добавить цель
        </Button>
      }
    >
      {goals.length === 0 ? (
        <Empty title="Целей не задано" description="Добавьте цель, чтобы отслеживать прогресс" />
      ) : (
        <ul className={s.goalsList}>
          {goals.map((g: ClientGoal) => (
            <li key={g.id} className={s.goal}>
              <div className={s.goalHeader}>
                <div>
                  <div className={s.goalMetric}>{metricLabels[g.metric] ?? g.metric}</div>
                  <div className={s.goalTarget}>
                    Цель: <strong>{g.target_value ?? '—'}</strong>
                    {g.target_date && <> • до {formatDate(g.target_date)}</>}
                  </div>
                </div>
                {g.achieved_at ? (
                  <Badge variant="success" iconLeft={<CheckCircle size={10} />}>
                    Достигнута
                  </Badge>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => goalsStore.markAchieved(g.id)}>
                    Отметить
                  </Button>
                )}
              </div>
              {g.progress_percent !== null && g.progress_percent !== undefined && (
                <div className={s.goalProgress}>
                  <div className={s.goalProgressBar}>
                    <div
                      className={s.goalProgressFill}
                      style={{ width: `${Math.min(100, g.progress_percent)}%` }}
                    />
                  </div>
                  <span className={s.goalProgressLabel}>
                    {g.progress_percent.toFixed(0)}%
                    {g.current_value !== null && g.current_value !== undefined && (
                      <> • текущее: {g.current_value}</>
                    )}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <GoalCreateModal
        open={creating}
        clientId={clientId}
        onClose={() => setCreating(false)}
      />
    </Card>
  );
});

function ProgramCreateModal({ open, clientId, onClose }: { open: boolean; clientId: number; onClose: () => void }) {
  const [form, setForm] = useState<ProgramCreate>({
    client_id: clientId,
    trainer_id: null,
    name: '',
    description: '',
    goal: '',
    duration_weeks: 12,
    sessions_per_week: 3,
    difficulty_level: 'medium',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      trainersStore.load();
      setForm({
        client_id: clientId,
        trainer_id: null,
        name: '',
        description: '',
        goal: '',
        duration_weeks: 12,
        sessions_per_week: 3,
        difficulty_level: 'medium',
      });
    }
  }, [open, clientId]);

  const trainerOptions = trainersStore.trainers.map(t => ({ value: t.id, label: t.name, hint: t.specialization ?? '' }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    setSubmitting(true);
    const id = await programsStore.create({
      ...form,
      description: form.description || null,
      goal: form.goal || null,
    });
    setSubmitting(false);
    if (id !== null) {
      onClose();
      await programsStore.load(clientId);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая программа"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button form="program-form" type="submit" loading={submitting} disabled={!form.name}>
            Создать
          </Button>
        </>
      }
    >
      <form id="program-form" onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Field label="Тренер">
          <Combobox
            options={trainerOptions}
            value={form.trainer_id ?? null}
            onChange={v => setForm({ ...form, trainer_id: typeof v === 'number' ? v : null })}
            placeholder="Без тренера"
          />
        </Field>
        <Field label="Название" required>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Цель">
          <Input value={form.goal ?? ''} onChange={e => setForm({ ...form, goal: e.target.value })} placeholder="Например: набрать мышечную массу" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
          <Field label="Длительность, недели">
            <Input type="number" min="1" max="52" value={form.duration_weeks} onChange={e => setForm({ ...form, duration_weeks: Number(e.target.value) })} />
          </Field>
          <Field label="Сессий в неделю">
            <Input type="number" min="1" max="14" value={form.sessions_per_week} onChange={e => setForm({ ...form, sessions_per_week: Number(e.target.value) })} />
          </Field>
          <Field label="Уровень">
            <Select value={form.difficulty_level} onChange={e => setForm({ ...form, difficulty_level: e.target.value })}>
              <option value="easy">Лёгкий</option>
              <option value="medium">Средний</option>
              <option value="hard">Высокий</option>
            </Select>
          </Field>
        </div>
        <Field label="Описание">
          <Textarea
            rows={3}
            value={form.description ?? ''}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
}

function GoalCreateModal({ open, clientId, onClose }: { open: boolean; clientId: number; onClose: () => void }) {
  const [metric, setMetric] = useState('weight');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload: ClientGoalCreate = {
      client_id: clientId,
      metric,
      target_value: target ? Number(target) : null,
      target_date: date || null,
    };
    const id = await goalsStore.create(payload);
    setSubmitting(false);
    if (id !== null) {
      onClose();
      setMetric('weight');
      setTarget('');
      setDate('');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая цель"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button form="goal-form" type="submit" loading={submitting}>Создать</Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <Field label="Метрика" required>
          <Select value={metric} onChange={e => setMetric(e.target.value)}>
            {Object.entries(metricLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field label="Целевое значение">
          <Input type="number" step="0.1" value={target} onChange={e => setTarget(e.target.value)} />
        </Field>
        <Field label="Целевая дата">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

const MetricsTab = observer(() => {
  const a = analyticsStore.clientAnalytics;
  if (!a) return <Card><Empty title="Нет данных" /></Card>;
  if (a.metrics_history.length === 0) {
    return <Card><Empty title="Замеры не загружены" /></Card>;
  }

  const data = a.metrics_history.map(m => ({
    date: m.measurement_date,
    weight: m.weight,
    body_fat: m.body_fat_percentage,
    muscle: m.muscle_mass,
  }));

  const weights = data.map(d => d.weight).filter((v): v is number => v != null);
  const muscles = data.map(d => d.muscle).filter((v): v is number => v != null);
  const bodyFats = data.map(d => d.body_fat).filter((v): v is number => v != null);

  const minKg = Math.min(...weights, ...muscles);
  const maxKg = Math.max(...weights, ...muscles);
  const kgPadding = maxKg > minKg ? (maxKg - minKg) * 0.15 : 2;

  const minFat = Math.min(...bodyFats);
  const maxFat = Math.max(...bodyFats);
  const fatPadding = maxFat > minFat ? (maxFat - minFat) * 0.15 : 2;

  return (
    <div className={s.grid}>
      <Card title="Динамика веса" className={s.fullSpan}>
        <div style={{ height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 11 }}
                tickFormatter={(v) => formatDate(v).slice(0, 6)} />
              <YAxis yAxisId="left" domain={[minKg - kgPadding, maxKg + kgPadding]} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" domain={[minFat - fatPadding, maxFat + fatPadding]} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)' }}
                labelFormatter={(v) => formatDate(v)}
              />
              <Line yAxisId="left" dataKey="weight" name="Вес, кг" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="left" dataKey="muscle" name="Мышцы, кг" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" dataKey="body_fat" name="% жира" stroke="var(--chart-4)" strokeWidth={2} dot={{ r: 3 }} />
              <Legend
                wrapperStyle={{ fontSize: '0.78rem' }}
                formatter={(v) => <span style={{ color: 'var(--text-secondary)' }}>{v}</span>}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {a.progress_analysis.insights.length > 0 && (
        <Card title="Инсайты по прогрессу" className={s.fullSpan}>
          <ul className={s.insights}>
            {a.progress_analysis.insights.map((i, idx) => (
              <li key={idx} className={s.insight} data-type={i.type}>
                {i.message}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
});

const ProgramsTab = observer(({ clientId }: { clientId: number }) => {
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    programsStore.load(clientId);
  }, [clientId]);

  const columns: Column<Program>[] = [
    { key: 'name', header: 'Название', cell: p => p.name },
    { key: 'goal', header: 'Цель', cell: p => p.goal ?? '—' },
    { key: 'duration', header: 'Длительность', cell: p => `${p.duration_weeks} нед.`, mono: true },
    { key: 'sessions', header: 'Сессий/нед.', cell: p => p.sessions_per_week, mono: true, align: 'right' },
    { key: 'level', header: 'Уровень', cell: p => p.difficulty_level },
    { key: 'status', header: 'Статус', cell: p => p.is_active
      ? <Badge variant="success">Активна</Badge>
      : <Badge variant="neutral">Завершена</Badge>
    },
  ];

  return (
    <Card
      title="Программы клиента"
      actions={
        authStore.role !== 'client' && (
          <Button size="sm" iconLeft={<Plus size={12} />} onClick={() => setCreating(true)}>
            Добавить программу
          </Button>
        )
      }
    >
      <DataTable
        columns={columns}
        rows={programsStore.programs}
        rowKey={p => p.id}
        loading={programsStore.isLoading}
        emptyTitle="Программ не назначено"
        onRowClick={p => navigate(`/programs/${p.id}`)}
      />
      <ProgramCreateModal
        open={creating}
        clientId={clientId}
        onClose={() => setCreating(false)}
      />
    </Card>
  );
});

const SessionsTab = observer(({ clientId }: { clientId: number }) => {
  useEffect(() => {
    sessionsStore.setFilter('client_id', clientId);
  }, [clientId]);

  const columns: Column<Session>[] = [
    { key: 'date', header: 'Дата', mono: true, cell: s_ => formatDate(s_.session_date) },
    { key: 'program', header: 'Программа', cell: s_ => s_.program_name ?? '—' },
    { key: 'trainer', header: 'Тренер', cell: s_ => s_.trainer_name ?? '—' },
    { key: 'duration', header: 'Длит., мин', mono: true, align: 'right', cell: s_ => s_.duration_minutes ?? '—' },
    { key: 'sat', header: 'Оценка', mono: true, align: 'right',
      cell: s_ => s_.satisfaction_rating ? `${s_.satisfaction_rating} / 5` : '—' },
  ];

  const navigate = useNavigate();

  return (
    <Card title="Журнал тренировок">
      <DataTable
        columns={columns}
        rows={sessionsStore.sessions}
        rowKey={s_ => s_.id}
        loading={sessionsStore.isLoading}
        emptyTitle="Тренировок не зафиксировано"
        onRowClick={s_ => navigate(`/sessions/${s_.id}`)}
      />
    </Card>
  );
});

const ProgramResultsTab = observer(() => {
  const a = analyticsStore.clientAnalytics;
  if (!a) return <Card><Empty title="Нет данных" /></Card>;

  const programs = a.program_analytics;
  if (!programs || programs.length === 0) {
    return (
      <Card>
        <Empty title="Нет программ для анализа" description="Назначьте программу и зафиксируйте результаты" />
      </Card>
    );
  }

  return (
    <div className={s.grid}>
      {programs.map((p: ProgramAnalytics) => (
        <Card
          key={p.program_id}
          title={p.program_name}
          className={s.fullSpan}
          subtitle={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {p.is_active ? (
                <Badge variant="success">Активна</Badge>
              ) : (
                <Badge variant="neutral">Завершена</Badge>
              )}
              {p.trainer_name && <span>• {p.trainer_name}</span>}
              {p.start_date && <span>• с {formatDate(p.start_date)}</span>}
              {p.goal && <span>• {goalLabels[p.goal] ?? p.goal}</span>}
            </div>
          }
        >
          <div className={s.programResultsBody}>
            {/* Статистика выполнения */}
            <div className={s.programStatsRow}>
              <div className={s.programStat}>
                <span className={s.programStatValue}>{p.sessions_count}</span>
                <span className={s.programStatLabel}>тренировок</span>
              </div>
              <div className={s.programStat}>
                <span className={s.programStatValue}>{Math.round(p.completion_rate * 100)}%</span>
                <span className={s.programStatLabel}>выполнение</span>
              </div>
              {p.avg_satisfaction !== null && (
                <div className={s.programStat}>
                  <span className={s.programStatValue}>{p.avg_satisfaction}</span>
                  <span className={s.programStatLabel}>удовл.</span>
                </div>
              )}
              {p.avg_duration !== null && (
                <div className={s.programStat}>
                  <span className={s.programStatValue}>{p.avg_duration} мин</span>
                  <span className={s.programStatLabel}>средняя длит.</span>
                </div>
              )}
              <div className={s.programStat}>
                <span className={s.programStatValue}>{p.total_calories}</span>
                <span className={s.programStatLabel}>ккал</span>
              </div>
            </div>

            {/* Изменение метрик */}
            {Object.keys(p.metrics_change).length > 0 && (
              <div className={s.programMetricsRow}>
                <h4 className={s.programSectionTitle}>Изменение показателей</h4>
                <div className={s.programMetrics}>
                  {p.metrics_change.weight !== undefined && (
                    <MetricBadge
                      label="Вес"
                      value={p.metrics_change.weight}
                      unit="кг"
                      inverse={false}
                    />
                  )}
                  {p.metrics_change.body_fat_percentage !== undefined && (
                    <MetricBadge
                      label="% жира"
                      value={p.metrics_change.body_fat_percentage}
                      unit="%"
                      inverse={false}
                    />
                  )}
                  {p.metrics_change.muscle_mass !== undefined && (
                    <MetricBadge
                      label="Мышцы"
                      value={p.metrics_change.muscle_mass}
                      unit="кг"
                      inverse={true}
                    />
                  )}
                  {p.metrics_change.max_pushups !== undefined && (
                    <MetricBadge
                      label="Отжимания"
                      value={p.metrics_change.max_pushups}
                      unit=""
                      inverse={true}
                    />
                  )}
                  {p.metrics_change.plank_seconds !== undefined && (
                    <MetricBadge
                      label="Планка"
                      value={p.metrics_change.plank_seconds}
                      unit="с"
                      inverse={true}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Прогресс по упражнениям */}
            {p.exercise_progress.length > 0 && (
              <div className={s.programExerciseProgress}>
                <h4 className={s.programSectionTitle}>Прогресс по упражнениям</h4>
                <div className={s.exerciseTableWrap}>
                  <table className={s.exerciseTable}>
                    <thead>
                      <tr>
                        <th>Упражнение</th>
                        <th align="right">Вес (нач.)</th>
                        <th align="right">Вес (кон.)</th>
                        <th align="right">Повт. (нач.)</th>
                        <th align="right">Повт. (кон.)</th>
                        <th align="right">RPE (нач.)</th>
                        <th align="right">RPE (кон.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.exercise_progress.map((ex, idx) => (
                        <tr key={idx}>
                          <td>{ex.exercise_name}</td>
                          <td className={s.num}>{ex.early_avg_weight ?? '—'}</td>
                          <td className={s.num}>{ex.late_avg_weight ?? '—'}</td>
                          <td className={s.num}>{ex.early_avg_reps ?? '—'}</td>
                          <td className={s.num}>{ex.late_avg_reps ?? '—'}</td>
                          <td className={s.num}>{ex.early_avg_rpe ?? '—'}</td>
                          <td className={s.num}>{ex.late_avg_rpe ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Рекомендации по коррекции */}
            {p.recommendations.length > 0 && (
              <div className={s.programRecommendations}>
                <h4 className={s.programSectionTitle}>Рекомендации по коррекции</h4>
                <ul className={s.insights}>
                  {p.recommendations.map((rec, idx) => (
                    <li key={idx} className={s.insight} data-type={
                      rec.includes('не снижается') || rec.includes('не растет') || rec.includes('стагнируют') || rec.includes('Низкая')
                        ? 'warning' : 'positive'
                    }>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
});

function MetricBadge({ label, value, unit, inverse }: { label: string; value: number; unit: string; inverse: boolean }) {
  const isPositive = inverse ? value > 0 : value < 0;
  const isNegative = inverse ? value < 0 : value > 0;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const absValue = Math.abs(value);
  const display = `${sign}${absValue.toFixed(absValue >= 10 ? 1 : 2)}${unit ? ' ' + unit : ''}`;

  return (
    <div className={`${s.metricBadge} ${isPositive ? s.metricBadgePos : isNegative ? s.metricBadgeNeg : ''}`}>
      <span className={s.metricBadgeLabel}>{label}</span>
      <span className={s.metricBadgeValue}>{display}</span>
    </div>
  );
}

const AnalyticsTab = observer(() => {
  const a = analyticsStore.clientAnalytics;
  if (!a) return <Card><Empty title="Нет аналитики" /></Card>;

  const churn = a.churn_risk;
  const stats = a.session_stats;

  return (
    <div className={s.grid}>
      <Stat
        label="Всего тренировок"
        value={formatNumber(stats.total_sessions)}
        icon={<ActivityIcon size={16} />}
      />
      <Stat
        label="За 30 дней"
        value={formatNumber(stats.sessions_30d)}
        icon={<ActivityIcon size={16} />}
        tone={stats.sessions_30d >= 12 ? 'success' : stats.sessions_30d >= 4 ? 'warning' : 'danger'}
      />
      <Stat
        label="Средняя оценка"
        value={stats.avg_satisfaction.toFixed(1)}
        unit="/ 5"
      />
      <Stat
        label="Риск оттока"
        value={churn.score.toFixed(0)}
        unit="/ 100"
        tone={churn.level === 'high' ? 'danger' : churn.level === 'medium' ? 'warning' : 'success'}
        hint={riskLabels[churn.level]}
      />

      <Card title="Разбивка балльной модели" className={s.fullSpan}
            subtitle="30 (частота) + 35 (удовлетворённость) + 35 (объём) = 100">
        <ScoreBreakdown components={churn.components} total={churn.score} />
        {churn.factors.length > 0 && (
          <ul className={s.factorsList}>
            {churn.factors.map((f, i) => (
              <li key={i} className={s.factor}>
                <AlertTriangle size={12} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
});

export default ClientProfile;
