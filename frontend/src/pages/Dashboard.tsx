import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Users, Target, Activity, Star, Database,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { authStore, dashboardStore } from '@/stores';
import { Page } from '@/components/Page';
import { Stat } from '@/components/Stat';
import { Card } from '@/components/Card';
import { ChartCard } from '@/components/ChartCard';
import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { formatNumber, goalLabels, clusterColor } from '@/utils/format';
import s from './Dashboard.module.scss';

const Dashboard = observer(() => {
  useEffect(() => {
    dashboardStore.load();
  }, []);

  const { data, isLoading, isGenerating, isEmpty } = dashboardStore;
  const isAdmin = authStore.role === 'admin';

  if (isLoading && !data) {
    return (
      <Page title="Панель управления" subtitle="Обзор активности и ключевые метрики">
        <div className={s.statsGrid}>
          {[0, 1, 2, 3].map(i => (
            <Card key={i} variant="metric"><Skeleton height={88} /></Card>
          ))}
        </div>
      </Page>
    );
  }

  if (isEmpty) {
    return (
      <Page title="Панель управления">
        <Empty
          title="Нет данных для отображения"
          description={isAdmin
            ? 'Сгенерируйте демо-данные, чтобы увидеть аналитику в действии.'
            : 'Демо-данные ещё не сгенерированы. Попросите администратора.'}
          action={isAdmin && (
            <Button
              iconLeft={<Database size={14} />}
              onClick={() => dashboardStore.generateDemoData()}
              loading={isGenerating}
            >
              Сгенерировать демо-данные
            </Button>
          )}
        />
      </Page>
    );
  }

  const summary = data!.summary;
  const totalGoals = data!.goal_distribution.reduce((sum, g) => sum + g.count, 0);
  const goalChartData = data!.goal_distribution.map(g => ({
    ...g,
    label: goalLabels[g.goal] ?? g.goal,
  }));

  return (
    <Page
      title="Панель управления"
      subtitle="Обзор активности фитнес-центра за последние 30 дней"
      actions={isAdmin && (
        <Button
          variant="secondary"
          iconLeft={<Database size={14} />}
          onClick={() => dashboardStore.generateDemoData()}
          loading={isGenerating}
        >
          Перегенерировать демо
        </Button>
      )}
    >
      <div className={`${s.statsGrid} stagger`} style={{ '--i': 0 } as React.CSSProperties}>
        <Stat
          label="Активные клиенты"
          value={formatNumber(summary.active_clients)}
          icon={<Users size={16} />}
          tone="success"
        />
        <Stat
          label="Активных программ"
          value={formatNumber(summary.active_programs)}
          icon={<Target size={16} />}
        />
        <Stat
          label="Тренировок за 30 дней"
          value={formatNumber(summary.sessions_30d)}
          icon={<Activity size={16} />}
          tone="success"
        />
        <Stat
          label="Удовлетворённость"
          value={summary.avg_satisfaction.toFixed(1)}
          unit="/ 5"
          icon={<Star size={16} />}
          tone={summary.avg_satisfaction >= 4 ? 'success' : 'warning'}
          hint="Средняя оценка за 30 дней"
        />
      </div>

      <div className={s.chartsGrid}>
        <ChartCard
          title="Динамика посещений"
          subtitle="Тренировок в неделю за последние 12 недель"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data!.weekly_visits}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="week" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                }}
                itemStyle={{ color: 'var(--text-primary)' }}
                labelStyle={{ color: 'var(--text-secondary)' }}
              />
              <Line
                type="monotone"
                dataKey="visits"
                name="Посещения"
                stroke="var(--success)"
                strokeWidth={2.5}
                dot={{ fill: 'var(--success)', r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive
                animationDuration={400}
              />
              <Legend
                wrapperStyle={{ fontSize: '0.78rem' }}
                formatter={(v) => <span style={{ color: 'var(--text-secondary)' }}>{v}</span>}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="По дням недели"
          subtitle="Распределение тренировок"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data!.visits_by_weekday}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                }}
                itemStyle={{ color: 'var(--text-primary)' }}
                labelStyle={{ color: 'var(--text-secondary)' }}
              />
              <Bar dataKey="visits" name="Посещения" fill="var(--info)" radius={[6, 6, 0, 0]} animationDuration={400} activeBar={{ fill: 'var(--info)', fillOpacity: 0.75 }} />
              <Legend
                wrapperStyle={{ fontSize: '0.78rem' }}
                formatter={(v) => <span style={{ color: 'var(--text-secondary)' }}>{v}</span>}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Цели клиентов"
          subtitle="Распределение по фитнес-целям"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={goalChartData}
                dataKey="count"
                nameKey="label"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                isAnimationActive
                animationDuration={400}
              >
                {goalChartData.map((_, i) => (
                  <Cell key={i} fill={clusterColor(i)} stroke="var(--bg-1)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                }}
                itemStyle={{ color: 'var(--text-primary)' }}
                labelStyle={{ color: 'var(--text-secondary)' }}
                formatter={(value: number, name: string) => [
                  `${value} чел. (${totalGoals > 0 ? ((value / totalGoals) * 100).toFixed(0) : 0}%)`,
                  name,
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: '0.78rem' }}
                formatter={(v) => <span style={{ color: 'var(--text-secondary)' }}>{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card title="Топ тренеров" subtitle="Рейтинг и количество сессий за 90 дней">
          {data!.top_trainers.length === 0 ? (
            <Empty title="Нет данных" />
          ) : (
            <ul className={s.trainersList}>
              {data!.top_trainers.map((t, i) => (
                <li key={t.name} className={s.trainerRow}>
                  <span className={s.trainerRank}>#{i + 1}</span>
                  <span className={s.trainerName}>{t.name}</span>
                  <span className={s.trainerStats}>
                    <span className={s.trainerSessions}>{t.sessions} сесс.</span>
                    <span className={s.trainerRating}>
                      <Star size={12} fill="var(--warning)" stroke="var(--warning)" />
                      {t.rating.toFixed(1)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
});

export default Dashboard;
