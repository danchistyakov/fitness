import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import s from './Stat.module.scss';

interface StatProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  delta?: { value: number; label?: string };
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export function Stat({ label, value, unit, hint, delta, icon, tone = 'default' }: StatProps) {
  return (
    <div className={`${s.stat} ${s[`tone-${tone}`]}`}>
      <header className={s.header}>
        <span className={s.label}>{label}</span>
        {icon && <span className={s.iconWrap}>{icon}</span>}
      </header>
      <div className={s.valueRow}>
        <span className={s.value}>{value}</span>
        {unit && <span className={s.unit}>{unit}</span>}
      </div>
      {(delta || hint) && (
        <footer className={s.footer}>
          {delta && (
            <span
              className={[
                s.delta,
                delta.value > 0 ? s.deltaUp :
                delta.value < 0 ? s.deltaDown : s.deltaFlat,
              ].join(' ')}
            >
              {delta.value > 0 ? <TrendingUp size={12} /> :
               delta.value < 0 ? <TrendingDown size={12} /> :
               <Minus size={12} />}
              {delta.value > 0 ? '+' : ''}{delta.value}
              {delta.label && <span className={s.deltaLabel}>{delta.label}</span>}
            </span>
          )}
          {hint && <span className={s.hint}>{hint}</span>}
        </footer>
      )}
    </div>
  );
}
