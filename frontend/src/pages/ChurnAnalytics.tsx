import { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import {
  AlertOctagon,
  Phone,
  HeartPulse,
  Calendar,
  ChevronRight,
  Info,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { analyticsStore } from '@/stores';
import type {
  ChurnAnalyticsData,
  ChurnClient,
  CoxCoefficient,
  KaplanMeierCurve,
} from '@/types/api';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Badge } from '@/components/Badge';
import { ScoreBreakdown } from '@/components/ScoreBreakdown';
import { KaplanMeierChart } from '@/components/KaplanMeierChart';
import { ForestPlot } from '@/components/ForestPlot';
import {
  formatDate, subscriptionLabels,
} from '@/utils/format';
import s from './ChurnAnalytics.module.scss';

// ── главная страница ──────────────────────────────────────────────────────

const ChurnAnalytics = observer(() => {
  useEffect(() => { analyticsStore.loadChurn(); }, []);

  const data = analyticsStore.churn;
  const isLoading = analyticsStore.isLoadingChurn;

  return (
    <Page
      title="Прогноз оттока клиентов"
      subtitle="Клиенты с повышенной вероятностью оттока и рекомендуемые действия по их удержанию."
    >
      {isLoading && !data && <Card><Skeleton height={360} /></Card>}

      {data && <Body data={data} />}
    </Page>
  );
});

// ── основной блок ─────────────────────────────────────────────────────────

function Body({ data }: { data: ChurnAnalyticsData }) {
  const navigate = useNavigate();

  const { risk_distribution, clients, survival_analysis, cox_regression } = data;
  const total = clients.length;
  const totalSafe = total || 1;

  const highRiskClients = useMemo(
    () => clients.filter(c => c.risk.level === 'high'),
    [clients],
  );
  const mediumRiskClients = useMemo(
    () => clients.filter(c => c.risk.level === 'medium'),
    [clients],
  );

  const dangerCount = risk_distribution.high;
  const dangerShare = dangerCount / totalSafe;
  const verdict = dangerShare >= 0.15
    ? { tone: 'high' as const,   word: 'Высокий уровень риска',  copy: 'Доля клиентов в зоне высокого риска превышает целевой порог. Требуется реакция в ближайшие дни.' }
    : dangerShare >= 0.05
    ? { tone: 'medium' as const, word: 'Контролируемая ситуация', copy: 'Доля клиентов в зоне риска находится в допустимых пределах, однако часть базы требует адресной работы.' }
    : { tone: 'low' as const,    word: 'Стабильная ситуация',    copy: 'Клиентская база стабильна. Приоритет — удержание лояльных клиентов.' };

  return (
    <div className={s.layout}>
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className={`${s.hero} ${s[`hero-${verdict.tone}`]}`}>
        <div className={s.heroEyebrow}>
          <AlertOctagon size={14} />
          <span>Прогноз оттока</span>
        </div>

        <h2 className={s.heroQuestion}>Объём клиентов в зоне риска</h2>

        <div className={s.heroBody}>
          <div className={s.heroSayHi}>{verdict.word}</div>
          <h1 className={s.heroNumber}>
            {dangerCount}
            <span className={s.heroOf}> из {total}</span>
          </h1>
          <p className={s.heroLine}>
            {verdict.copy}
            {' '}В зоне <strong>высокого риска</strong> сейчас{' '}
            <strong>{dangerCount} {ruClients(dangerCount)}</strong>{' '}
            ({(dangerShare * 100).toFixed(1)}% базы).
          </p>
        </div>

        <div className={s.heroChips}>
          <HeroChip
            icon={<ShieldAlert size={13} />}
            label="Высокий риск"
            value={`${risk_distribution.high} • ${pct(risk_distribution.high, totalSafe)}`}
            tone="danger"
          />
          <HeroChip
            icon={<HeartPulse size={13} />}
            label="Средний риск"
            value={`${risk_distribution.medium} • ${pct(risk_distribution.medium, totalSafe)}`}
            tone="warning"
          />
          <HeroChip
            icon={<ShieldCheck size={13} />}
            label="Низкий риск"
            value={`${risk_distribution.low} • ${pct(risk_distribution.low, totalSafe)}`}
            tone="success"
          />
        </div>

        <div className={s.distribution}>
          <div className={s.distributionLabel}>Распределение по уровню риска</div>
          <div className={s.distributionBar}>
            <div
              className={`${s.distributionSeg} ${s.distributionSegHigh}`}
              style={{ flexGrow: risk_distribution.high }}
              title={`Высокий: ${risk_distribution.high}`}
            />
            <div
              className={`${s.distributionSeg} ${s.distributionSegMed}`}
              style={{ flexGrow: risk_distribution.medium }}
              title={`Средний: ${risk_distribution.medium}`}
            />
            <div
              className={`${s.distributionSeg} ${s.distributionSegLow}`}
              style={{ flexGrow: risk_distribution.low }}
              title={`Низкий: ${risk_distribution.low}`}
            />
          </div>
        </div>
      </section>

      {/* ── КОГО СПАСАТЬ ────────────────────────────────────────── */}
      <Card
        padding="comfortable"
        title="Приоритеты по удержанию"
        subtitle={
          highRiskClients.length > 0
            ? `Первые ${Math.min(highRiskClients.length, 8)} клиентов с наибольшей вероятностью оттока`
            : 'Клиентов в зоне высокого риска не выявлено'
        }
      >
        {highRiskClients.length === 0 && mediumRiskClients.length === 0 ? (
          <Empty
            title="Уязвимых клиентов не выявлено"
            description="Продолжайте действующую программу удержания."
            icon={<ShieldCheck size={28} />}
          />
        ) : (
          <ul className={s.dangerList}>
            {(highRiskClients.length > 0 ? highRiskClients : mediumRiskClients)
              .slice(0, 8)
              .map(c => (
                <DangerRow
                  key={c.client_id}
                  client={c}
                  onOpen={() => navigate(`/clients/${c.client_id}`)}
                />
              ))}
          </ul>
        )}
      </Card>

      {/* ── ЧТО ВЫТАЛКИВАЕТ ───────────────────────────────────── */}
      {cox_regression.available && cox_regression.coefficients.length > 0 && (
        <Card
          padding="comfortable"
          title="Факторы, влияющие на отток"
          subtitle="Признаки, статистически связанные с уходом клиентов из клуба"
        >
          <ul className={s.factors}>
            {cox_regression.coefficients
              .map(c => ({ c, sentence: coxSentence(c) }))
              .sort((a, b) => (a.c.p_value < 0.05 ? -1 : 1) - (b.c.p_value < 0.05 ? -1 : 1))
              .slice(0, 4)
              .map(({ c, sentence }) => (
                <FactorRow key={c.covariate} cox={c} sentence={sentence} />
              ))}
          </ul>
          <p className={s.factorsFootnote}>
            Зависимости рассчитаны на текущей выборке клиентов.
            Признаки со статусом «связь не доказана» требуют большего объёма
            данных для статистического подтверждения.
          </p>
        </Card>
      )}

      {/* ── СКОЛЬКО ДЕРЖАТСЯ ──────────────────────────────────── */}
      {survival_analysis.available && survival_analysis.curves.length > 0 && (
        <Card
          padding="comfortable"
          title="Срок удержания клиентов"
          subtitle="Медианная продолжительность активности по типу абонемента"
        >
          <div className={s.tenureGrid}>
            {survival_analysis.curves.map((curve, i) => (
              <TenureCard key={curve.group} curve={curve} idx={i} />
            ))}
          </div>
        </Card>
      )}

      {/* ── ЧТО ДЕЛАТЬ ─────────────────────────────────────────── */}
      <Card padding="comfortable">
        <div className={s.tipBlock}>
          <div className={s.tipIcon}><Sparkles size={18} /></div>
          <div>
            <h3 className={s.tipTitle}>Регламент работы со списком</h3>
            <ol className={s.tipList}>
              <li>
                <strong>В течение дня.</strong> Назначить контактные действия по первым трём клиентам:
                звонок или сообщение от тренера с предложением вернуться на занятия.
              </li>
              <li>
                <strong>В течение недели.</strong> По клиентам с низкими оценками удовлетворённости —
                персональная беседа для выяснения причины, при необходимости смена тренера или формата.
              </li>
              <li>
                <strong>На постоянной основе.</strong> Настроить автоматические напоминания
                клиентам без посещений более 14 дней — это снизит приток в группу высокого риска.
              </li>
            </ol>
          </div>
        </div>
      </Card>

      {/* ── ДЕТАЛИ ─────────────────────────────────────────────── */}
      <details className={s.details}>
        <summary className={s.detailsSummary}>
          <Info size={14} />
          <span>Для аналитика: модель Кокса и кривые Каплана-Майера</span>
          <ChevronRight size={14} className={s.detailsChevron} />
        </summary>

        <div className={s.detailsBody}>
          {cox_regression.available ? (
            <>
              <div className={s.detailsTestInfo}>
                <div>
                  <span className={s.detailsLabel}>Метод</span>
                  <span className={s.detailsValue}>Cox Proportional Hazards</span>
                </div>
                <div>
                  <span className={s.detailsLabel}>C-индекс</span>
                  <span className={s.detailsValue}>{cox_regression.concordance_index}</span>
                </div>
                <div>
                  <span className={s.detailsLabel}>Наблюдений</span>
                  <span className={s.detailsValue}>{cox_regression.n} (событий: {cox_regression.events})</span>
                </div>
              </div>
              <div className={s.forestWrap}>
                <ForestPlot coefficients={cox_regression.coefficients} />
              </div>
            </>
          ) : (
            <Empty title="Регрессия Кокса недоступна" description={cox_regression.reason} />
          )}

          {survival_analysis.available ? (
            <div className={s.detailsKM}>
              <div className={s.detailsLabel}>Кривые Каплана-Майера</div>
              <KaplanMeierChart curves={survival_analysis.curves} height={320} />
              {survival_analysis.logrank && (
                <p className={s.detailsKMNote}>
                  Log-rank: χ² = {survival_analysis.logrank.statistic},
                  {' '}p-value = {survival_analysis.logrank.p_value < 0.001 ? '<0.001' : survival_analysis.logrank.p_value.toFixed(3)}
                </p>
              )}
            </div>
          ) : (
            <Empty title="Анализ выживаемости недоступен" description={survival_analysis.reason} />
          )}

          <details className={s.subDetails}>
            <summary className={s.subDetailsSummary}>
              Полный список клиентов с риском ({clients.length})
            </summary>
            <ul className={s.fullClientList}>
              {clients.map(c => (
                <li
                  key={c.client_id}
                  className={s.fullClientRow}
                  onClick={() => navigate(`/clients/${c.client_id}`)}
                >
                  <div className={s.fullClientName}>{c.client_name}</div>
                  <div className={s.fullClientMeta}>
                    {c.subscription_type && (
                      <span>{subscriptionLabels[c.subscription_type] ?? c.subscription_type}</span>
                    )}
                    <span>• сессий: {c.total_sessions}</span>
                    <span>• последняя: {formatDate(c.last_session)}</span>
                  </div>
                  <span className={s.fullClientScore}>{c.risk.score.toFixed(0)}</span>
                  <Badge variant={
                    c.risk.level === 'high' ? 'danger' :
                    c.risk.level === 'medium' ? 'warning' : 'success'
                  } size="sm">
                    {riskWord(c.risk.level)}
                  </Badge>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </details>
    </div>
  );
}

// ── строка опасной зоны ───────────────────────────────────────────────────

function DangerRow({ client, onOpen }: { client: ChurnClient; onOpen: () => void }) {
  const subscriptionLabel = client.subscription_type
    ? subscriptionLabels[client.subscription_type] ?? client.subscription_type
    : null;

  const action = primaryAction(client);

  return (
    <li className={s.danger} onClick={onOpen}>
      <div className={s.dangerHead}>
        <div className={s.dangerNamewrap}>
          <h4 className={s.dangerName}>{client.client_name}</h4>
          <div className={s.dangerMeta}>
            {subscriptionLabel && <Badge variant="info" size="sm">{subscriptionLabel}</Badge>}
            <span><Calendar size={11} /> Последнее посещение {formatDate(client.last_session)}</span>
            <span>• {client.total_sessions} {ruSessions(client.total_sessions)}</span>
          </div>
        </div>
        <div className={s.dangerScoreBlock}>
          <span className={s.dangerScore}>{client.risk.score.toFixed(0)}</span>
          <Badge
            variant={client.risk.level === 'high' ? 'danger' : client.risk.level === 'medium' ? 'warning' : 'success'}
            size="sm"
          >
            {riskWord(client.risk.level)}
          </Badge>
        </div>
      </div>

      <ScoreBreakdown
        components={client.risk.components}
        total={client.risk.score}
        compact
      />

      {client.risk.factors.length > 0 && (
        <ul className={s.dangerFactors}>
          {client.risk.factors.map((f, i) => (
            <li key={i}><span className={s.dangerDot}>!</span>{f}</li>
          ))}
        </ul>
      )}

      <div className={s.dangerActions}>
        <span className={s.dangerCta}>
          <Phone size={13} /> {action}
        </span>
        <span className={s.dangerOpen}>
          Открыть карточку <ChevronRight size={13} />
        </span>
      </div>
    </li>
  );
}

// ── строка фактора риска (Cox) ────────────────────────────────────────────

function FactorRow({ cox, sentence }: { cox: CoxCoefficient; sentence: ReturnType<typeof coxSentence> }) {
  const significant = cox.p_value < 0.05;
  const direction = cox.hazard_ratio > 1 ? 'up' : 'down';
  const Arrow = direction === 'up' ? TrendingUp : TrendingDown;

  return (
    <li className={`${s.factor} ${significant ? s.factorStrong : ''}`}>
      <div className={`${s.factorIcon} ${s[`factorIcon-${sentence.tone}`]}`}>
        <Arrow size={16} />
      </div>
      <div className={s.factorBody}>
        <p className={s.factorText}>{sentence.text}</p>
        <div className={s.factorMeta}>
          <Badge
            variant={significant ? (sentence.tone === 'success' ? 'success' : 'warning') : 'neutral'}
            size="sm"
          >
            {significant ? 'Связь подтверждена' : 'Связь не доказана'}
          </Badge>
          <span className={s.factorHr}>
            HR {cox.hazard_ratio.toFixed(2)}
            {' '}
            <span className={s.factorCi}>
              [{cox.ci_lower.toFixed(2)}–{cox.ci_upper.toFixed(2)}]
            </span>
          </span>
        </div>
      </div>
    </li>
  );
}

// ── срок жизни клиента ────────────────────────────────────────────────────

function TenureCard({ curve, idx }: { curve: KaplanMeierCurve; idx: number }) {
  const median = curve.median_survival_days;
  const months = median !== null ? median / 30.44 : null;
  const groupLabel = subscriptionLabels[curve.group] ?? curve.group;

  return (
    <div className={s.tenure} style={{ '--accent': clusterColorIndex(idx) } as React.CSSProperties}>
      <div className={s.tenureHead}>
        <span className={s.tenureDot} style={{ background: clusterColorIndex(idx) }} />
        <h4 className={s.tenureGroup}>{capitalize(groupLabel)}</h4>
      </div>
      {months !== null ? (
        <>
          <div className={s.tenureValue}>
            ≈ {months.toFixed(1)}
            <span className={s.tenureUnit}> мес.</span>
          </div>
          <p className={s.tenureNote}>
            Медианный срок удержания: к этой отметке отток составляет 50% группы.
          </p>
        </>
      ) : (
        <>
          <div className={s.tenureValueAlt}>удерживаются</div>
          <p className={s.tenureNote}>
            Более половины клиентов группы продолжают занятия — медианное время удержания
            пока не достигнуто.
          </p>
        </>
      )}
      <div className={s.tenureFoot}>
        {curve.n} {ruClients(curve.n)} • ушло {curve.events}
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────

function HeroChip({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: string; tone: 'danger' | 'warning' | 'success' }) {
  return (
    <div className={`${s.heroChip} ${s[`heroChip-${tone}`]}`}>
      <span className={s.heroChipIcon}>{icon}</span>
      <span className={s.heroChipLabel}>{label}</span>
      <span className={s.heroChipValue}>{value}</span>
    </div>
  );
}

function pct(part: number, whole: number): string {
  return `${((part / whole) * 100).toFixed(0)}%`;
}

function ruClients(n: number): string {
  const m = Math.abs(n) % 100;
  const r = m % 10;
  if (m >= 11 && m <= 14) return 'клиентов';
  if (r === 1) return 'клиент';
  if (r >= 2 && r <= 4) return 'клиента';
  return 'клиентов';
}

function ruSessions(n: number): string {
  const m = Math.abs(n) % 100;
  const r = m % 10;
  if (m >= 11 && m <= 14) return 'тренировок';
  if (r === 1) return 'тренировка';
  if (r >= 2 && r <= 4) return 'тренировки';
  return 'тренировок';
}

function riskWord(level: 'high' | 'medium' | 'low'): string {
  if (level === 'high')   return 'Высокий риск';
  if (level === 'medium') return 'Средний риск';
  return 'Низкий риск';
}

function capitalize(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

function clusterColorIndex(i: number): string {
  const palette = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];
  return palette[i % palette.length];
}

function primaryAction(client: ChurnClient): string {
  // выбираем первый по приоритету фактор
  const factors = client.risk.factors.join(' | ').toLowerCase();
  if (factors.includes('часто') || factors.includes('30 дней')) {
    return 'Позвонить и пригласить на тренировку';
  }
  if (factors.includes('удовлет') || factors.includes('оценк')) {
    return 'Связаться, выяснить причину низких оценок';
  }
  if (factors.includes('малое') || factors.includes('тренировок')) {
    return 'Предложить вводное занятие с тренером';
  }
  return 'Связаться с клиентом';
}

function coxSentence(c: CoxCoefficient): { text: string; tone: 'success' | 'warning' | 'neutral' } {
  const direction = c.hazard_ratio > 1 ? 'up' : c.hazard_ratio < 1 ? 'down' : 'flat';

  switch (c.covariate) {
    case 'age':
      if (direction === 'up')   return { text: 'С возрастом риск оттока возрастает — старшая аудитория уходит чаще.', tone: 'warning' };
      if (direction === 'down') return { text: 'Старшая аудитория удерживается дольше младшей — она более стабильна.', tone: 'success' };
      break;
    case 'total_sessions':
      if (direction === 'down') return { text: 'Чем выше число проведённых тренировок, тем ниже риск оттока. Постоянные клиенты сохраняют активность в долгосрочной перспективе.', tone: 'success' };
      if (direction === 'up')   return { text: 'Большее число тренировок ассоциировано с повышением риска оттока. Возможен эффект перегрузки — рекомендуется анализ интенсивности нагрузки.', tone: 'warning' };
      break;
    case 'avg_satisfaction':
      if (direction === 'down') return { text: 'Каждый дополнительный балл удовлетворённости снижает риск оттока. Контроль оценок после тренировок — приоритет.', tone: 'success' };
      if (direction === 'up')   return { text: 'Высокие оценки связаны с уходом — нетипичная зависимость. Возможно завышение оценок перед прекращением занятий, требуется отдельный анализ.', tone: 'warning' };
      break;
  }
  // запасной — по сырому имени
  if (direction === 'up') {
    return { text: `Признак «${c.covariate}» повышает риск ухода.`, tone: 'warning' };
  }
  if (direction === 'down') {
    return { text: `Признак «${c.covariate}» снижает риск ухода.`, tone: 'success' };
  }
  return { text: `Признак «${c.covariate}» практически не влияет на отток.`, tone: 'neutral' };
}

export default ChurnAnalytics;
