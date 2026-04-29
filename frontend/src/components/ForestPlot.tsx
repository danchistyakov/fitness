import s from './ForestPlot.module.scss';
import type { CoxCoefficient } from '@/types/api';

interface ForestPlotProps {
  coefficients: CoxCoefficient[];
  refValue?: number;
}

export function ForestPlot({ coefficients, refValue = 1 }: ForestPlotProps) {
  if (coefficients.length === 0) {
    return <p className={s.empty}>Недостаточно данных для модели</p>;
  }

  const allLowers = coefficients.map(c => c.ci_lower);
  const allUppers = coefficients.map(c => c.ci_upper);
  const min = Math.max(0.05, Math.min(...allLowers, refValue * 0.7));
  const max = Math.max(...allUppers, refValue * 1.3);

  // log-scale: x = log(value), нормализованный к [0, 100]
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  const span = logMax - logMin || 1;
  const project = (v: number) => ((Math.log(v) - logMin) / span) * 100;

  const refX = project(refValue);

  return (
    <div className={s.plot}>
      <div className={s.axisHeader}>
        <span>0.5×</span>
        <span className={s.refLabel}>HR = {refValue}</span>
        <span>2×</span>
      </div>
      {coefficients.map(c => {
        const significant = c.p_value < 0.05;
        const lo = project(c.ci_lower);
        const hi = project(c.ci_upper);
        const point = project(c.hazard_ratio);

        return (
          <div key={c.covariate} className={s.row}>
            <div className={s.label}>{c.covariate}</div>
            <div className={s.track}>
              <div
                className={s.refLine}
                style={{ left: `${refX}%` }}
                aria-hidden="true"
              />
              <div
                className={`${s.ci} ${significant ? s.ciSignificant : ''}`}
                style={{ left: `${lo}%`, width: `${hi - lo}%` }}
              />
              <div
                className={`${s.point} ${significant ? s.pointSignificant : ''}`}
                style={{ left: `${point}%` }}
                title={`HR = ${c.hazard_ratio} (95% ДИ: ${c.ci_lower}–${c.ci_upper})`}
              />
            </div>
            <div className={s.values}>
              <span className={s.hr}>{c.hazard_ratio.toFixed(2)}</span>
              <span className={s.ci_text}>
                [{c.ci_lower.toFixed(2)}–{c.ci_upper.toFixed(2)}]
              </span>
              <span className={`${s.p} ${significant ? s.pSignificant : ''}`}>
                p={c.p_value < 0.001 ? '<0.001' : c.p_value.toFixed(3)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
