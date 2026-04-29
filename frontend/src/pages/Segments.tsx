import { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Component as Cluster,
  Users,
  Sparkles,
  Info,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Scale,
  Flame,
  Dumbbell,
  Timer,
  Activity,
} from 'lucide-react';
import { analyticsStore } from '@/stores';
import type { ClusterSummary, SegmentsData } from '@/types/api';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Field } from '@/components/Field';
import { Select } from '@/components/Input';
import { Badge } from '@/components/Badge';
import { PCAScatter } from '@/components/PCAScatter';
import { clusterColor, formatNumber } from '@/utils/format';
import s from './Segments.module.scss';

// ── каталог признаков ─────────────────────────────────────────────────────

type FeatureKey = 'age' | 'weight' | 'body_fat' | 'pushups' | 'plank_sec' | 'visits_per_week';

interface FeatureMeta {
  short: string;
  unit: string;
  highWord: string;        // прилагательное, когда значение высокое («старше»)
  lowWord:  string;        // прилагательное, когда значение низкое («моложе»)
  highIsGood: boolean;     // true — больше = лучше для клуба/клиента
  icon: React.ComponentType<{ size?: number }>;
}

const FEATURES: Record<FeatureKey, FeatureMeta> = {
  age: {
    short: 'Возраст',
    unit: 'лет',
    highWord: 'старше остальных',
    lowWord:  'моложе остальных',
    highIsGood: false,
    icon: Calendar,
  },
  weight: {
    short: 'Вес',
    unit: 'кг',
    highWord: 'тяжелее среднего',
    lowWord:  'легче среднего',
    highIsGood: false,
    icon: Scale,
  },
  body_fat: {
    short: '% жира',
    unit: '%',
    highWord: 'выше % жира',
    lowWord:  'ниже % жира',
    highIsGood: false,
    icon: Flame,
  },
  pushups: {
    short: 'Отжимания',
    unit: 'повт.',
    highWord: 'сильнее в отжиманиях',
    lowWord:  'отжимаются меньше',
    highIsGood: true,
    icon: Dumbbell,
  },
  plank_sec: {
    short: 'Планка',
    unit: 'сек',
    highWord: 'дольше держат планку',
    lowWord:  'короче держат планку',
    highIsGood: true,
    icon: Timer,
  },
  visits_per_week: {
    short: 'Посещений в неделю',
    unit: '/нед',
    highWord: 'чаще ходят в зал',
    lowWord:  'реже ходят в зал',
    highIsGood: true,
    icon: Activity,
  },
};

const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

// ── генерация портретов ───────────────────────────────────────────────────

interface Trait {
  feature: FeatureKey;
  direction: 'high' | 'low';
  ratio: number;            // во сколько раз отклонение от среднего (для подсказки)
  raw: number;
}

interface ClusterPortrait {
  cluster: ClusterSummary;
  share: number;            // доля от выборки [0..1]
  name: string;             // сгенерированное название
  summary: string;          // одно предложение
  traits: Trait[];          // топ-3 ярких признака
  actions: string[];        // 1-2 рекомендации
}

function buildPortraits(clusters: ClusterSummary[]): ClusterPortrait[] {
  const totalSize = clusters.reduce((s, c) => s + c.size, 0) || 1;

  // взвешенное среднее по выборке
  const overall: Record<FeatureKey, number> = FEATURE_KEYS.reduce((acc, f) => {
    let sum = 0;
    let n = 0;
    for (const c of clusters) {
      const v = c.centroid[f];
      if (typeof v === 'number') {
        sum += v * c.size;
        n += c.size;
      }
    }
    acc[f] = n > 0 ? sum / n : 0;
    return acc;
  }, {} as Record<FeatureKey, number>);

  return clusters.map(cluster => {
    const traits: Trait[] = [];
    for (const f of FEATURE_KEYS) {
      const v = cluster.centroid[f];
      const ref = overall[f];
      if (typeof v !== 'number' || !ref) continue;
      const ratio = v / ref - 1;             // -0.2 = на 20% ниже среднего
      if (Math.abs(ratio) < 0.08) continue;  // <8% — не считаем заметным
      traits.push({
        feature: f,
        direction: ratio > 0 ? 'high' : 'low',
        ratio: Math.abs(ratio),
        raw: v,
      });
    }
    traits.sort((a, b) => b.ratio - a.ratio);
    const top = traits.slice(0, 3);

    const name = nameFromTraits(top);
    const summary = summaryFromTraits(top);
    const actions = actionsFromTraits(top);

    return {
      cluster,
      share: cluster.size / totalSize,
      name,
      summary,
      traits: top,
      actions,
    };
  });
}

function nameFromTraits(traits: Trait[]): string {
  if (traits.length === 0) return 'Средние клиенты';

  // Определяем «характер» по главным признакам
  const hi = (f: FeatureKey) => traits.find(t => t.feature === f && t.direction === 'high');
  const lo = (f: FeatureKey) => traits.find(t => t.feature === f && t.direction === 'low');

  if (hi('visits_per_week') && (hi('pushups') || hi('plank_sec'))) return 'Активные с высокой подготовкой';
  if (hi('visits_per_week') && hi('age')) return 'Старшая аудитория с регулярными посещениями';
  if (hi('visits_per_week')) return 'Регулярные посетители';
  if (lo('visits_per_week') && hi('body_fat')) return 'Группа риска оттока';
  if (lo('visits_per_week')) return 'Низкая частота посещений';
  if (hi('body_fat') && lo('pushups')) return 'С запросом на коррекцию формы';
  if (hi('body_fat')) return 'Цель — снижение веса';
  if (hi('pushups') && hi('plank_sec')) return 'Высокий уровень силовой подготовки';
  if (lo('pushups') && lo('plank_sec')) return 'Начальный уровень подготовки';
  if (hi('age')) return 'Старшая возрастная группа';
  if (lo('age')) return 'Младшая возрастная группа';
  if (hi('weight')) return 'Клиенты с повышенной массой тела';

  // запасной вариант — берём яркий признак
  const t = traits[0];
  const meta = FEATURES[t.feature];
  return t.direction === 'high' ? `Группа: ${meta.highWord}` : `Группа: ${meta.lowWord}`;
}

function summaryFromTraits(traits: Trait[]): string {
  if (traits.length === 0) return 'По ключевым показателям клиенты этой группы близки к среднему по клубу.';
  const phrases = traits.map(t => {
    const meta = FEATURES[t.feature];
    return t.direction === 'high' ? meta.highWord : meta.lowWord;
  });
  if (phrases.length === 1) return capitalize(phrases[0]) + '.';
  if (phrases.length === 2) return capitalize(phrases[0]) + ', а также ' + phrases[1] + '.';
  return capitalize(phrases[0]) + ', ' + phrases[1] + ', ' + phrases[2] + '.';
}

function actionsFromTraits(traits: Trait[]): string[] {
  const actions: string[] = [];
  const hi = (f: FeatureKey) => traits.find(t => t.feature === f && t.direction === 'high');
  const lo = (f: FeatureKey) => traits.find(t => t.feature === f && t.direction === 'low');

  if (lo('visits_per_week')) {
    actions.push('Запустить программы вовлечения: персональные звонки, push-напоминания, бонусы за регулярные посещения.');
  }
  if (hi('visits_per_week') && (hi('pushups') || hi('plank_sec'))) {
    actions.push('Лояльная аудитория с высокой вовлечённостью — собирать отзывы, использовать в маркетинговых материалах, привлекать к реферальной программе.');
  }
  if (hi('body_fat')) {
    actions.push('Предлагать программы снижения веса, кардио-форматы, групповые жиросжигающие тренировки.');
  }
  if (lo('pushups') && lo('plank_sec')) {
    actions.push('Стартовые силовые программы под контролем тренера с постепенным наращиванием нагрузки.');
  }
  if (hi('pushups') && hi('plank_sec') && !hi('visits_per_week')) {
    actions.push('Клиенты с высоким уровнем подготовки — предложить кроссфит, продвинутые программы, соревновательные форматы.');
  }
  if (hi('age')) {
    actions.push('Низкоударные программы, восстановительные занятия, ЛФК, утренние группы.');
  }
  if (lo('age') && hi('visits_per_week')) {
    actions.push('Молодая лояльная аудитория — высокая отдача от активности в соцсетях и реферальных акций.');
  }

  if (actions.length === 0) {
    actions.push('Сбалансированная группа — стандартные программы клуба соответствуют профилю.');
  }

  return actions.slice(0, 2);
}

function capitalize(str: string): string {
  if (!str) return str;
  return str[0].toUpperCase() + str.slice(1);
}

// ── главная страница ──────────────────────────────────────────────────────

const Segments = observer(() => {
  useEffect(() => { analyticsStore.loadSegments(); }, []);

  const data = analyticsStore.segments;
  const isLoading = analyticsStore.isLoadingSegments;
  const k = analyticsStore.segmentsK;

  return (
    <Page
      title="Сегментация клиентской базы"
      subtitle="Разбиение базы на группы с близкими профилями для построения адресных предложений."
      actions={
        <Field label="Сколько групп">
          <Select
            value={k}
            onChange={e => analyticsStore.setSegmentsK(Number(e.target.value))}
          >
            {[2, 3, 4, 5, 6, 7, 8].map(v => (
              <option key={v} value={v}>{v} {ruGroupCount(v)}</option>
            ))}
          </Select>
        </Field>
      }
    >
      {isLoading && !data && <Card><Skeleton height={360} /></Card>}

      {data && !data.available && (
        <Card>
          <Empty
            title="Пока недостаточно данных для разбиения"
            description={humanizeSegmentsReason(data.reason)}
            icon={<Cluster size={28} />}
          />
        </Card>
      )}

      {data?.available && <SegmentsBody data={data} />}
    </Page>
  );
});

// ── основной блок ─────────────────────────────────────────────────────────

interface BodyProps { data: Extract<SegmentsData, { available: true }> }

function SegmentsBody({ data }: BodyProps) {
  const portraits = useMemo(() => buildPortraits(data.clusters), [data.clusters]);
  const totalClients = data.points.length;
  const sortedByShare = [...portraits].sort((a, b) => b.share - a.share);
  const biggest = sortedByShare[0];

  const quality = clusterQuality(data.silhouette);

  return (
    <div className={s.layout}>
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className={s.hero}>
        <div className={s.heroEyebrow}>
          <Cluster size={14} />
          <span>Карта клиентской базы</span>
        </div>

        <h2 className={s.heroQuestion}>Состав клиентской базы по типовым профилям</h2>

        <div className={s.heroBody}>
          <div className={s.heroSayHi}>{ruGroupCountTitle(data.k)}</div>
          <h1 className={s.heroNumber}>
            {data.k}
            <span className={s.heroNumberWord}>{ruGroupCount(data.k)}</span>
          </h1>
          <p className={s.heroLine}>
            Крупнейшая группа — <strong>«{biggest.name}»</strong>{' '}
            ({Math.round(biggest.share * 100)}% базы).
            {quality.tone === 'good' && ' Группы статистически хорошо различимы.'}
            {quality.tone === 'mixed' && ' Группы частично пересекаются, границы между ними размыты.'}
            {quality.tone === 'weak' && ' Чёткого деления на типы не выявлено — клиентская база однородна.'}
          </p>
        </div>

        <div className={s.heroChips}>
          <HeroChip icon={<Users size={13} />} label="Клиентов в анализе" value={formatNumber(totalClients)} />
          <HeroChip icon={<Cluster size={13} />} label="Найдено групп" value={data.k.toString()} />
          <HeroChip
            icon={<Sparkles size={13} />}
            label="Качество разбиения"
            value={quality.label}
            tone={quality.tone === 'good' ? 'success' : 'neutral'}
          />
        </div>

        {/* мини-полоса распределения */}
        <div className={s.distribution}>
          <div className={s.distributionLabel}>Размер групп</div>
          <div className={s.distributionBar}>
            {sortedByShare.map(p => (
              <div
                key={p.cluster.cluster}
                className={s.distributionSeg}
                style={{
                  flexGrow: p.share,
                  background: clusterColor(p.cluster.cluster),
                }}
                title={`${p.name}: ${p.cluster.size} (${Math.round(p.share * 100)}%)`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── КАРТОЧКИ ГРУПП ───────────────────────────────────────── */}
      <div className={s.portraitsGrid}>
        {portraits.map(p => <PortraitCard key={p.cluster.cluster} portrait={p} />)}
      </div>

      {/* ── ПОДСКАЗКА ────────────────────────────────────────────── */}
      <Card padding="comfortable">
        <div className={s.tipBlock}>
          <div className={s.tipIcon}><Sparkles size={18} /></div>
          <div>
            <h3 className={s.tipTitle}>Применение результатов сегментации</h3>
            <p className={s.tipText}>
              В разделе <strong>«Клиенты»</strong> сопоставьте профили клиентов с рекомендациями
              по соответствующим группам. Для изменения степени детализации измените количество
              групп в селекторе вверху страницы. Малочисленные группы (менее 5–10% базы)
              целесообразно объединять с близкими по характеристикам.
            </p>
          </div>
        </div>
      </Card>

      {/* ── ДЕТАЛИ ───────────────────────────────────────────────── */}
      <details className={s.details}>
        <summary className={s.detailsSummary}>
          <Info size={14} />
          <span>Для аналитика: PCA-проекция и центроиды</span>
          <ChevronRight size={14} className={s.detailsChevron} />
        </summary>

        <div className={s.detailsBody}>
          <div className={s.detailsTestInfo}>
            <div>
              <span className={s.detailsLabel}>Метод</span>
              <span className={s.detailsValue}>K-means + PCA</span>
            </div>
            <div>
              <span className={s.detailsLabel}>Silhouette score</span>
              <span className={s.detailsValue}>
                {data.silhouette !== null ? data.silhouette.toFixed(3) : '—'}
              </span>
            </div>
            <div>
              <span className={s.detailsLabel}>Объяснённая дисперсия</span>
              <span className={s.detailsValue}>
                {(data.explained_variance.reduce((a, b) => a + b, 0) * 100).toFixed(1)}%
                {' '}
                <span className={s.detailsValueMuted}>
                  (PC1: {(data.explained_variance[0] * 100).toFixed(1)}% • PC2: {(data.explained_variance[1] * 100).toFixed(1)}%)
                </span>
              </span>
            </div>
          </div>

          <div className={s.scatterWrap}>
            <PCAScatter points={data.points} height={420} />
          </div>

          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Кластер</th>
                  <th align="right">Размер</th>
                  {FEATURE_KEYS.map(f => (
                    <th key={f} align="right">{FEATURES[f].short}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.clusters.map(c => (
                  <tr key={c.cluster}>
                    <td>
                      <span className={s.clusterCell}>
                        <span className={s.swatch} style={{ background: clusterColor(c.cluster) }} />
                        Кластер {c.cluster}
                      </span>
                    </td>
                    <td className={s.num}>{c.size}</td>
                    {FEATURE_KEYS.map(f => (
                      <td key={f} className={s.num}>
                        {c.centroid[f]?.toFixed(1) ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
}

// ── карточка группы ───────────────────────────────────────────────────────

function PortraitCard({ portrait }: { portrait: ClusterPortrait }) {
  const { cluster, name, summary, traits, actions, share } = portrait;
  const color = clusterColor(cluster.cluster);

  return (
    <article className={s.portrait} style={{ '--accent': color } as React.CSSProperties}>
      <header className={s.portraitHeader}>
        <span className={s.portraitNum} style={{ background: color }}>{cluster.cluster + 1}</span>
        <div className={s.portraitTitle}>
          <h3 className={s.portraitName}>{name}</h3>
          <span className={s.portraitSize}>
            {cluster.size} клиентов • {Math.round(share * 100)}% базы
          </span>
        </div>
      </header>

      <p className={s.portraitSummary}>{summary}</p>

      {traits.length > 0 && (
        <ul className={s.traitList}>
          {traits.map(t => {
            const meta = FEATURES[t.feature];
            const TrIcon = meta.icon;
            const arrowGood =
              (t.direction === 'high' && meta.highIsGood) ||
              (t.direction === 'low' && !meta.highIsGood);
            const Arrow = t.direction === 'high' ? TrendingUp : TrendingDown;
            return (
              <li key={t.feature} className={s.trait}>
                <span className={s.traitIcon}><TrIcon size={14} /></span>
                <span className={s.traitLabel}>{meta.short}</span>
                <span className={s.traitValue}>
                  {t.raw.toFixed(1)} {meta.unit}
                </span>
                <span className={`${s.traitArrow} ${arrowGood ? s.traitArrowGood : s.traitArrowWarn}`}>
                  <Arrow size={12} />
                  <span>{Math.round(t.ratio * 100)}%</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className={s.actionsBlock}>
        <Badge variant="info" size="sm">Что делать</Badge>
        <ul className={s.actionsList}>
          {actions.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </div>
    </article>
  );
}

// ── HERO chip ─────────────────────────────────────────────────────────────

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

// ── helpers ───────────────────────────────────────────────────────────────

function clusterQuality(silhouette: number | null): { label: string; tone: 'good' | 'mixed' | 'weak' } {
  if (silhouette === null) return { label: 'Не определено', tone: 'mixed' };
  if (silhouette > 0.5)  return { label: 'Высокое',  tone: 'good' };
  if (silhouette > 0.25) return { label: 'Среднее',  tone: 'mixed' };
  return { label: 'Низкое', tone: 'weak' };
}

function ruGroupCount(n: number): string {
  if (n === 1) return 'группа';
  if (n >= 2 && n <= 4) return 'группы';
  return 'групп';
}

function ruGroupCountTitle(n: number): string {
  if (n === 1) return 'Найдена';
  if (n >= 2 && n <= 4) return 'Найдено';
  return 'Найдено';
}

function humanizeSegmentsReason(reason: string): string {
  if (!reason) return 'Недостаточно клиентов с заполненными показателями (вес, возраст, % жира, отжимания).';
  if (/sample|size|n\s*<|enough|insufficient/i.test(reason)) {
    return 'Недостаточно клиентов с полным набором показателей. Обеспечьте регулярную фиксацию замеров тренерами — сегментация будет рассчитана автоматически.';
  }
  if (/k|cluster|features?/i.test(reason)) {
    return 'Недостаточно признаков для кластеризации. Заполните у клиентов пол, цели и регулярные замеры — алгоритм построит сегменты автоматически.';
  }
  return reason;
}

export default Segments;
