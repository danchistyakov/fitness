import { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Clock,
  CalendarDays,
  Activity,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { analyticsStore } from '@/stores';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Skeleton } from '@/components/Skeleton';
import { formatNumber } from '@/utils/format';
import s from './GymLoad.module.scss';

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${i}:00`);
const DAY_NAMES_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const GymLoad = observer(() => {
  useEffect(() => { analyticsStore.loadGymLoad(); }, []);

  const data = analyticsStore.gymLoad;
  const isLoading = analyticsStore.isLoadingGymLoad;

  const maxCell = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.by_weekday_hour.flatMap(d => d.hours), 1);
  }, [data]);

  return (
    <Page
      title="Загруженность спортзала"
      subtitle="Распределение посещений по часам и дням недели за последние 30 дней."
    >
      {isLoading && !data && (
        <div className={s.layout}>
          <Card><Skeleton height={180} /></Card>
          <Card><Skeleton height={320} /></Card>
          <Card><Skeleton height={400} /></Card>
        </div>
      )}

      {data && (
        <div className={s.layout}>
          {/* ── HERO ─────────────────────────────────────────────── */}
          <section className={s.hero}>
            <div className={s.heroEyebrow}>
              <Activity size={14} />
              <span>Загруженность</span>
            </div>

            <h2 className={s.heroQuestion}>Насколько интенсивно используется зал?</h2>

            <div className={s.heroBody}>
              <div className={s.heroSayHi}>Средняя загруженность</div>
              <h1 className={s.heroNumber}>
                {data.avg_per_day}
                <span className={s.heroUnit}> тренировок/день</span>
              </h1>
              <p className={s.heroLine}>
                За последние 30 дней зафиксировано{' '}
                <strong>{formatNumber(data.total_sessions_30d)}</strong> тренировок.
                {data.peak_hours.length > 0 && (
                  <> Пиковое время — <strong>{data.peak_hours[0].hour}:00</strong>.</>
                )}
              </p>
            </div>

            <div className={s.heroChips}>
              <HeroChip icon={<Clock size={13} />} label="Всего за 30 дней" value={formatNumber(data.total_sessions_30d)} />
              <HeroChip icon={<CalendarDays size={13} />} label="Средне в день" value={data.avg_per_day.toString()} />
              {data.peak_hours[0] && (
                <HeroChip icon={<Zap size={13} />} label="Пиковый час" value={`${data.peak_hours[0].hour}:00`} tone="warning" />
              )}
            </div>
          </section>

          {/* ── ГРАФИК ПО ЧАСАМ ──────────────────────────────────── */}
          <Card title="Посещения по часам" subtitle="Распределение тренировок в течение суток">
            <div className={s.chartWrap}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.by_hour}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(v: number) => `${v}`}
                    stroke="var(--text-muted)"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-2)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-md)',
                    }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    labelStyle={{ color: 'var(--text-secondary)' }}
                    formatter={(value: number) => [`${value} трен.`, 'Посещения']}
                    labelFormatter={(label: number) => `${label}:00 — ${label + 1}:00`}
                  />
                  <Bar dataKey="visits" fill="var(--info)" radius={[6, 6, 0, 0]} animationDuration={400} activeBar={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* ── ТЕПЛОВАЯ КАРТА ───────────────────────────────────── */}
          <Card title="Тепловая карта" subtitle="Интенсивность посещений по дням недели и часам">
            <div className={s.heatmapWrap}>
              <div className={s.heatmap}>
                <div className={s.heatmapRow}>
                  <div className={s.heatmapCorner} />
                  {HOUR_LABELS.map(h => (
                    <div key={h} className={s.heatmapColHeader}>{h}</div>
                  ))}
                </div>
                {data.by_weekday_hour.map((row, i) => (
                  <div key={row.day} className={s.heatmapRow}>
                    <div className={s.heatmapRowHeader}>{DAY_NAMES_SHORT[i]}</div>
                    {row.hours.map((visits, h) => {
                      const intensity = maxCell > 0 ? visits / maxCell : 0;
                      return (
                        <div
                          key={h}
                          className={s.heatmapCell}
                          style={{
                            background: `color-mix(in srgb, var(--info) ${Math.round(intensity * 100)}%, var(--bg-2))`,
                          }}
                          title={`${row.day}, ${h}:00 — ${visits} трен.`}
                        >
                          <span className={intensity > 0.5 ? s.heatmapCellLight : ''}>{visits || ''}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className={s.heatmapLegend}>
              <span>Меньше</span>
              <div className={s.heatmapLegendBar} />
              <span>Больше</span>
            </div>
          </Card>
        </div>
      )}
    </Page>
  );
});

function HeroChip({
  icon, label, value, tone = 'neutral',
}: { icon: React.ReactNode; label: string; value: string; tone?: 'neutral' | 'warning' }) {
  return (
    <div className={`${s.heroChip} ${tone === 'warning' ? s.heroChipWarning : ''}`}>
      <span className={s.heroChipIcon}>{icon}</span>
      <span className={s.heroChipLabel}>{label}</span>
      <span className={s.heroChipValue}>{value}</span>
    </div>
  );
}

export default GymLoad;
