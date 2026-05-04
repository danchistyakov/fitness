import { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Trophy,
  Sparkles,
  Scale,
  Flame,
  Dumbbell,
  Users,
  Target,
} from 'lucide-react';
import { analyticsStore } from '@/stores';
import type {
  ProgramsMetric,
  PairwiseComparison,
  DescriptiveStat,
  ProgramsAnalyticsData,
} from '@/types/api';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Field } from '@/components/Field';
import { Select } from '@/components/Input';
import { Badge } from '@/components/Badge';
import s from './ProgramsAnalytics.module.scss';

// ── метрики ────────────────────────────────────────────────────────────────

interface MetricConfig {
  short: string;
  long: string;
  question: string;
  unit: string;
  goalLower: boolean;            // true если меньше = лучше
  improvedVerb: string;           // «снизили вес», «нарастили отжимания»
  icon: React.ComponentType<{ size?: number }>;
}

const METRICS: Record<ProgramsMetric, MetricConfig> = {
  weight_change: {
    short: 'Снижение веса',
    long: 'Изменение веса (кг)',
    question: 'Какая программа лучше помогает снизить вес?',
    unit: 'кг',
    goalLower: true,
    improvedVerb: 'снизили вес',
    icon: Scale,
  },
  bodyfat_change: {
    short: 'Снижение % жира',
    long: 'Изменение процента жира',
    question: 'Какая программа лучше уменьшает процент жира?',
    unit: '%',
    goalLower: true,
    improvedVerb: 'снизили процент жира',
    icon: Flame,
  },
  pushups_change: {
    short: 'Прирост отжиманий',
    long: 'Изменение количества отжиманий',
    question: 'Какая программа сильнее повышает силу (отжимания)?',
    unit: 'повторений',
    goalLower: false,
    improvedVerb: 'улучшили результат',
    icon: Dumbbell,
  },
};

// ── интерпретации ──────────────────────────────────────────────────────────

function effectSize(d: number) {
  const abs = Math.abs(d);
  if (abs < 0.2) return { label: 'различие незначительное', strength: 0 };
  if (abs < 0.5) return { label: 'малый эффект', strength: 1 };
  if (abs < 0.8) return { label: 'средний эффект', strength: 2 };
  return { label: 'большой эффект', strength: 3 };
}

type Confidence = 'high' | 'medium' | 'low' | 'none';

function confidenceFromHolm(p: number): Confidence {
  if (p < 0.01) return 'high';
  if (p < 0.05) return 'medium';
  if (p < 0.1) return 'low';
  return 'none';
}

const CONFIDENCE_COPY: Record<Confidence, { label: string; tone: 'success' | 'info' | 'warning' | 'neutral' }> = {
  high:   { label: 'Подтверждено',                tone: 'success' },
  medium: { label: 'Статистически значимо',       tone: 'success' },
  low:    { label: 'Тенденция, не значимо',       tone: 'warning' },
  none:   { label: 'Различия не выявлены',        tone: 'neutral' },
};

function isImproved(value: number, goalLower: boolean) {
  return goalLower ? value < 0 : value > 0;
}

function formatChange(value: number, _unit: string, goalLower: boolean) {
  const abs = Math.abs(value);
  const rounded = abs.toFixed(abs >= 10 ? 1 : 2);
  const arrow = isImproved(value, goalLower) ? '↓' : value === 0 ? '–' : '↑';
  return { number: rounded, arrow, sign: value < 0 ? '−' : value > 0 ? '+' : '' };
}

// формирует понятную фразу для пары
function pairSentence(p: PairwiseComparison, cfg: MetricConfig) {
  const conf = confidenceFromHolm(p.p_value_holm);
  const eff = effectSize(p.cohens_d);

  // тот, у кого среднее «лучше» (по направлению цели), считается лидером пары
  // mean_diff = mean(A) - mean(B) — но мы не знаем, это не индикатор «лучше»
  // полагаемся на знак: если goalLower и mean_diff < 0, то A лучше B
  let leader: string;
  let follower: string;
  let gap = Math.abs(p.mean_diff);
  if (cfg.goalLower) {
    if (p.mean_diff < 0) { leader = p.program_a; follower = p.program_b; }
    else                 { leader = p.program_b; follower = p.program_a; }
  } else {
    if (p.mean_diff > 0) { leader = p.program_a; follower = p.program_b; }
    else                 { leader = p.program_b; follower = p.program_a; }
  }

  return { leader, follower, gap, conf, eff };
}

// ── главная страница ───────────────────────────────────────────────────────

const ProgramsAnalytics = observer(() => {
  useEffect(() => { analyticsStore.loadPrograms(); }, []);

  const data = analyticsStore.programs;
  const isLoading = analyticsStore.isLoadingPrograms;
  const metric = analyticsStore.programsMetric;
  const cfg = METRICS[metric];
  const Icon = cfg.icon;

  return (
    <Page
      title="Сравнение эффективности программ"
      subtitle="Сопоставление результатов тренировочных программ по выбранному показателю эффективности."
      actions={
        <Field label="Что сравниваем">
          <Select
            value={metric}
            onChange={e => analyticsStore.setProgramsMetric(e.target.value as ProgramsMetric)}
          >
            {(Object.keys(METRICS) as ProgramsMetric[]).map(m => (
              <option key={m} value={m}>{METRICS[m].short}</option>
            ))}
          </Select>
        </Field>
      }
    >
      {isLoading && !data && <Card><Skeleton height={320} /></Card>}

      {data && !data.available && (
        <Card>
          <Empty
            title="Пока недостаточно данных"
            description={humanizeReason(data.reason)}
            icon={<Icon size={28} />}
          />
        </Card>
      )}

      {data?.available && (
        <Body data={data} cfg={cfg} />
      )}
    </Page>
  );
});

// ── разбор «available» ─────────────────────────────────────────────────────

interface BodyProps {
  data: Extract<ProgramsAnalyticsData, { available: true }>;
  cfg: MetricConfig;
}

function Body({ data, cfg }: BodyProps) {
  // Сортируем программы по «лучше → хуже»
  const ranked = useMemo(() => {
    const arr = [...data.descriptive];
    arr.sort((a, b) => cfg.goalLower ? a.mean - b.mean : b.mean - a.mean);
    return arr;
  }, [data.descriptive, cfg.goalLower]);

  const leader = ranked[0];
  const lastPlace = ranked[ranked.length - 1];
  const totalClients = data.descriptive.reduce((sum, d) => sum + d.n, 0);
  const overallSignificant = data.overall_test.p_value < 0.05;

  // диапазон средних — для бара
  const maxAbs = Math.max(...data.descriptive.map(d => Math.abs(d.mean)), 0.5);

  // топ-3 находки среди пар
  const findings = useMemo(() => {
    return [...data.pairwise]
      .map(p => ({ pair: p, parsed: pairSentence(p, cfg) }))
      .sort((a, b) => {
        // сначала «подтверждённые» крупные эффекты
        const scoreA = (a.parsed.conf === 'high' ? 3 : a.parsed.conf === 'medium' ? 2 : a.parsed.conf === 'low' ? 1 : 0) * 10
                     + a.parsed.eff.strength;
        const scoreB = (b.parsed.conf === 'high' ? 3 : b.parsed.conf === 'medium' ? 2 : b.parsed.conf === 'low' ? 1 : 0) * 10
                     + b.parsed.eff.strength;
        return scoreB - scoreA;
      });
  }, [data.pairwise, cfg]);

  const Icon = cfg.icon;

  return (
    <div className={s.layout}>
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className={s.hero}>
        <div className={s.heroEyebrow}>
          <Icon size={14} />
          <span>{cfg.long}</span>
        </div>

        <h2 className={s.heroQuestion}>{cfg.question}</h2>

        {overallSignificant ? (
          <LeaderHeadline leader={leader} cfg={cfg} totalClients={totalClients} />
        ) : (
          <NoWinnerHeadline programs={data.descriptive.length} totalClients={totalClients} />
        )}

        <div className={s.heroChips}>
          <HeroChip icon={<Trophy size={13} />} label="Сравнено программ" value={data.descriptive.length.toString()} />
          <HeroChip icon={<Users size={13} />} label="Клиентов в анализе" value={totalClients.toString()} />
          <HeroChip
            icon={<Sparkles size={13} />}
            label="Статистическая значимость"
            value={overallSignificant ? 'Подтверждена' : 'Не выявлена'}
            tone={overallSignificant ? 'success' : 'neutral'}
          />
        </div>
      </section>

      {/* ── РЕЙТИНГ ──────────────────────────────────────────────────── */}
      <Card padding="comfortable" title="Рейтинг программ" subtitle={`Какие программы дают наибольший прирост по показателю «${cfg.improvedVerb}»`}>
        <ul className={s.rank}>
          {ranked.map((d, i) => (
            <RankRow
              key={d.program}
              row={d}
              place={i + 1}
              isLeader={i === 0 && d.program === leader.program && overallSignificant}
              isWorst={i === ranked.length - 1 && ranked.length > 1 && lastPlace.program === d.program}
              cfg={cfg}
              maxAbs={maxAbs}
              totalClients={totalClients}
            />
          ))}
        </ul>
      </Card>

      {/* ── НАХОДКИ ──────────────────────────────────────────────────── */}
      {findings.length > 0 && (
        <Card
          padding="comfortable"
          title="Результаты попарного сравнения"
          subtitle="Выводы по каждой паре программ с поправкой Холма на множественные сравнения"
        >
          <ul className={s.findings}>
            {findings.map(({ pair, parsed }, i) => (
              <FindingItem key={i} pair={pair} parsed={parsed} cfg={cfg} />
            ))}
          </ul>
        </Card>
      )}

      {/* ── ЧТО ДЕЛАТЬ ───────────────────────────────────────────────── */}
      <ActionCard
        leader={leader}
        ranked={ranked}
        overallSignificant={overallSignificant}
        cfg={cfg}
        findings={findings}
      />

    </div>
  );
}

// ── HERO sub-blocks ────────────────────────────────────────────────────────

function LeaderHeadline({
  leader, cfg, totalClients,
}: { leader: DescriptiveStat; cfg: MetricConfig; totalClients: number }) {
  const fmt = formatChange(leader.mean, cfg.unit, cfg.goalLower);
  const improved = isImproved(leader.mean, cfg.goalLower);
  return (
    <div className={s.heroBody}>
      <div className={s.heroSayHi}>Лидер за период</div>
      <h1 className={s.heroProgram}>{leader.program}</h1>
      <p className={s.heroLine}>
        Клиенты на этой программе в среднем
        <span className={`${s.heroNumber} ${improved ? s.heroNumberPos : s.heroNumberNeg}`}>
          <span className={s.heroSign}>{fmt.sign}</span>
          {fmt.number}
          <span className={s.heroUnit}> {cfg.unit}</span>
        </span>
        — {improved ? 'результат соответствует целевому направлению.' : 'это наихудший результат среди программ.'}
      </p>
      <p className={s.heroFootnote}>
        Расчёт по {totalClients} клиентам • {leader.n} из них на программе «{leader.program}»
      </p>
    </div>
  );
}

function NoWinnerHeadline({ programs, totalClients }: { programs: number; totalClients: number }) {
  return (
    <div className={s.heroBody}>
      <div className={s.heroSayHi}>Однозначного лидера нет</div>
      <h1 className={s.heroProgramFlat}>Программы дают близкий результат</h1>
      <p className={s.heroLine}>
        Различия между {programs} программами статистически незначимы и не позволяют выделить лидера.
        Возможные причины — недостаточный объём выборки или фактически близкая эффективность программ.
      </p>
      <p className={s.heroFootnote}>
        Расчёт по данным {totalClients} клиентов
      </p>
    </div>
  );
}

function HeroChip({
  icon, label, value, tone = 'neutral',
}: { icon: React.ReactNode; label: string; value: string; tone?: 'success' | 'neutral' }) {
  return (
    <div className={`${s.heroChip} ${tone === 'success' ? s.heroChipSuccess : ''}`}>
      <span className={s.heroChipIcon}>{icon}</span>
      <span className={s.heroChipLabel}>{label}</span>
      <span className={s.heroChipValue}>{value}</span>
    </div>
  );
}

// ── RANK ROW ───────────────────────────────────────────────────────────────

interface RankRowProps {
  row: DescriptiveStat;
  place: number;
  isLeader: boolean;
  isWorst: boolean;
  cfg: MetricConfig;
  maxAbs: number;
  totalClients: number;
}

function RankRow({ row, place, isLeader, isWorst, cfg, maxAbs, totalClients }: RankRowProps) {
  const improved = isImproved(row.mean, cfg.goalLower);
  const fmt = formatChange(row.mean, cfg.unit, cfg.goalLower);
  const widthPct = Math.min(95, (Math.abs(row.mean) / maxAbs) * 95);
  const sharePct = totalClients > 0 ? Math.round((row.n / totalClients) * 100) : 0;

  return (
    <li className={`${s.rankRow} ${isLeader ? s.rankRowLeader : ''}`}>
      <div className={s.rankPlace}>
        {isLeader ? <Trophy size={16} /> : <span className={s.rankNum}>{place}</span>}
      </div>

      <div className={s.rankMain}>
        <div className={s.rankHead}>
          <h4 className={s.rankProgram}>{row.program}</h4>
          {isLeader && <Badge variant="success" size="sm">Лидер</Badge>}
          {isWorst && !isLeader && <Badge variant="neutral" size="sm">Наименьший результат</Badge>}
        </div>

        <div className={s.rankBarRow}>
          <div className={`${s.rankBar} ${improved ? s.rankBarPos : s.rankBarNeg}`}>
            <div className={s.rankBarFill} style={{ width: `${widthPct}%` }} />
          </div>
          <span className={`${s.rankValue} ${improved ? s.rankValuePos : s.rankValueNeg}`}>
            {fmt.sign}{fmt.number}
            <span className={s.rankUnit}> {cfg.unit}</span>
          </span>
        </div>

        <div className={s.rankMeta}>
          <span><Users size={11} /> {row.n} клиентов • {sharePct}% выборки</span>
          <span className={s.rankSep}>•</span>
          <span>медиана {row.median.toFixed(1)} {cfg.unit}</span>
          <span className={s.rankSep}>•</span>
          <span>разброс ±{row.std.toFixed(1)}</span>
        </div>
      </div>
    </li>
  );
}

// ── FINDING ROW ────────────────────────────────────────────────────────────

interface FindingItemProps {
  pair: PairwiseComparison;
  parsed: ReturnType<typeof pairSentence>;
  cfg: MetricConfig;
}

function FindingItem({ pair, parsed, cfg }: FindingItemProps) {
  const conf = CONFIDENCE_COPY[parsed.conf];
  const isStrong = parsed.conf === 'high' || parsed.conf === 'medium';
  const isFlat = parsed.eff.strength === 0;

  const sentence = isFlat
    ? <>Программы <strong>«{pair.program_a}»</strong> и <strong>«{pair.program_b}»</strong> демонстрируют сопоставимый результат.</>
    : <>Программа <strong>«{parsed.leader}»</strong> {cfg.improvedVerb} в среднем на <strong>{parsed.gap.toFixed(2)} {cfg.unit}</strong> больше, чем «{parsed.follower}».</>;

  return (
    <li className={`${s.finding} ${isStrong ? s.findingStrong : ''} ${isFlat ? s.findingFlat : ''}`}>
      <div className={s.findingStripe} />

      <div className={s.findingBody}>
        <p className={s.findingSentence}>{sentence}</p>
        <div className={s.findingMeta}>
          <Badge variant={conf.tone} size="sm">{conf.label}</Badge>
          {!isFlat && <Badge variant="neutral" size="sm">Эффект: {parsed.eff.label}</Badge>}
          <span className={s.findingHint}>
            95% ДИ: от {pair.ci95[0].toFixed(1)} до {pair.ci95[1].toFixed(1)} {cfg.unit}
          </span>
        </div>
      </div>
    </li>
  );
}

// ── ACTION CARD ────────────────────────────────────────────────────────────

interface ActionCardProps {
  leader: DescriptiveStat;
  ranked: DescriptiveStat[];
  overallSignificant: boolean;
  cfg: MetricConfig;
  findings: { pair: PairwiseComparison; parsed: ReturnType<typeof pairSentence> }[];
}

function ActionCard({ leader, ranked, overallSignificant, cfg, findings }: ActionCardProps) {
  const strongFindings = findings.filter(f => f.parsed.conf === 'high' || f.parsed.conf === 'medium');
  const tinySamples = ranked.filter(r => r.n < 10);

  return (
    <Card padding="comfortable">
      <div className={s.action}>
        <div className={s.actionIcon}><Target size={18} /></div>
        <div className={s.actionBody}>
          <h3 className={s.actionTitle}>Управленческие выводы</h3>
          <ul className={s.actionList}>
            {overallSignificant ? (
              <li>
                <strong>Программа «{leader.program}»</strong> показывает наилучший результат
                по выбранному показателю. Рекомендуется приоритетное назначение этой программы
                новым клиентам с релевантными целями.
              </li>
            ) : (
              <li>
                Различия между программами статистически незначимы по данной метрике.
                Выбор программы целесообразно осуществлять по предпочтениям клиента,
                расписанию тренеров и текущей загрузке зала.
              </li>
            )}

            {strongFindings.length > 0 && strongFindings[0].parsed.conf === 'high' && (
              <li>
                Наиболее значимое различие — между <strong>«{strongFindings[0].parsed.leader}»</strong>
                {' '}и <strong>«{strongFindings[0].parsed.follower}»</strong>.
                При наличии у клиента соответствующей цели рекомендуется перевод на «{strongFindings[0].parsed.leader}».
              </li>
            )}

            {tinySamples.length > 0 && (
              <li>
                По программам <strong>{tinySamples.map(t => `«${t.program}»`).join(', ')}</strong>
                {' '}объём выборки ограничен (менее 10 клиентов) — выводы носят предварительный характер
                и подлежат уточнению по мере накопления данных.
              </li>
            )}

            <li className={s.actionMuted}>
              Расчёт выполнен по показателю «{cfg.long.toLowerCase()}». Для анализа по другому
              показателю используйте селектор в правом верхнем углу.
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

function humanizeReason(reason: string): string {
  if (!reason) return 'Сравнение недоступно: недостаточно данных.';
  if (/groups|programs/i.test(reason)) {
    return 'Для сравнения требуются минимум две программы с достаточным числом клиентов и измерений. После регулярной фиксации замеров результат будет рассчитан автоматически.';
  }
  if (/sample|size|n\s*<|measurements/i.test(reason)) {
    return 'Недостаточный объём измерений у клиентов на программах. Регулярная фиксация замеров тренерами обеспечит расчёт результата в течение 2–4 недель.';
  }
  return reason;
}

export default ProgramsAnalytics;
