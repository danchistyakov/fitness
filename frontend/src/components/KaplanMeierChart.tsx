import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend,
} from 'recharts';
import type { KaplanMeierCurve } from '@/types/api';
import { clusterColor } from '@/utils/format';

interface KaplanMeierChartProps {
  curves: KaplanMeierCurve[];
  height?: number;
}

interface MergedPoint {
  t: number;
  [groupKey: string]: number | undefined;
}

export function KaplanMeierChart({ curves, height = 320 }: KaplanMeierChartProps) {
  const allTimes = new Set<number>([0]);
  for (const c of curves) for (const t of c.timeline) allTimes.add(t);
  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

  const data: MergedPoint[] = sortedTimes.map(t => {
    const point: MergedPoint = { t };
    for (const c of curves) {
      let last = 1;
      for (let i = 0; i < c.timeline.length; i++) {
        if (c.timeline[i] <= t) last = c.survival[i];
        else break;
      }
      point[c.group] = last;
    }
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          stroke="var(--text-muted)"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          label={{ value: 'Дни', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)', fontSize: 11 }}
        />
        <YAxis
          domain={[0, 1]}
          stroke="var(--text-muted)"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          tickFormatter={v => `${Math.round(v * 100)}%`}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--bg-2)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
          }}
          formatter={(v: number, name: string) => [`${(v * 100).toFixed(1)}%`, name]}
          labelFormatter={(t) => `${t} дней`}
        />
        <Legend
          wrapperStyle={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
        />
        {curves.map((c, i) => (
          <Line
            key={c.group}
            type="stepAfter"
            dataKey={c.group}
            stroke={clusterColor(i)}
            strokeWidth={2}
            dot={false}
            isAnimationActive
            animationDuration={400}
            animationEasing="ease-out"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
