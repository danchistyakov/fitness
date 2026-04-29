import {
  ResponsiveContainer, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ZAxis, Legend,
} from 'recharts';
import type { SegmentPoint } from '@/types/api';
import { clusterColor } from '@/utils/format';

interface PCAScatterProps {
  points: SegmentPoint[];
  height?: number;
}

interface TooltipPayload {
  payload: SegmentPoint;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 12px',
      fontSize: '0.82rem',
      boxShadow: 'var(--shadow-2)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
      <div style={{ color: 'var(--text-secondary)' }}>
        Кластер {p.cluster}{p.goal ? ` • ${p.goal}` : ''}
      </div>
      <div style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
        ({p.x.toFixed(2)}, {p.y.toFixed(2)})
      </div>
    </div>
  );
}

export function PCAScatter({ points, height = 360 }: PCAScatterProps) {
  const groups = new Map<number, SegmentPoint[]>();
  for (const p of points) {
    if (!groups.has(p.cluster)) groups.set(p.cluster, []);
    groups.get(p.cluster)!.push(p);
  }
  const sorted = [...groups.entries()].sort(([a], [b]) => a - b);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="x"
          name="PC1"
          stroke="var(--text-muted)"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          label={{ value: 'PC1', position: 'insideBottom', offset: 0, fill: 'var(--text-muted)', fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="PC2"
          stroke="var(--text-muted)"
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          label={{ value: 'PC2', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }}
        />
        <ZAxis range={[60, 60]} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }} />
        <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
        {sorted.map(([cluster, data]) => (
          <Scatter
            key={cluster}
            name={`Кластер ${cluster}`}
            data={data}
            fill={clusterColor(cluster)}
            isAnimationActive
            animationDuration={400}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
