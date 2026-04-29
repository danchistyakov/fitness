import s from './ScoreBreakdown.module.scss';
import type { ChurnRiskComponents } from '@/types/api';

interface ScoreBreakdownProps {
  components: ChurnRiskComponents;
  total: number;
  compact?: boolean;
}

const SEGMENTS: Array<{
  key: keyof ChurnRiskComponents;
  max: number;
  color: string;
  label: string;
}> = [
  { key: 'frequency',    max: 30, color: 'var(--chart-2)', label: 'Частота' },
  { key: 'satisfaction', max: 35, color: 'var(--chart-4)', label: 'Удовлетв.' },
  { key: 'engagement',   max: 35, color: 'var(--chart-5)', label: 'Объём' },
];

export function ScoreBreakdown({ components, total, compact = false }: ScoreBreakdownProps) {
  return (
    <div className={`${s.wrap} ${compact ? s.compact : ''}`}>
      <div className={s.bar}>
        {SEGMENTS.map(seg => {
          const value = components[seg.key];
          const widthPct = (value / 100) * 100;
          return (
            <div
              key={seg.key}
              className={s.fill}
              style={{ width: `${widthPct}%`, background: seg.color }}
              title={`${seg.label}: ${value} / ${seg.max}`}
            />
          );
        })}
        <div className={s.empty} style={{ width: `${100 - total}%` }} />
      </div>
      {!compact && (
        <div className={s.legend}>
          {SEGMENTS.map(seg => (
            <div key={seg.key} className={s.legendItem}>
              <span className={s.swatch} style={{ background: seg.color }} />
              <span className={s.legendLabel}>{seg.label}</span>
              <span className={s.legendValue}>
                {components[seg.key].toFixed(1)} / {seg.max}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
