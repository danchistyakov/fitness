import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Lightbulb, RefreshCw, Check, AlertTriangle, CalendarDays } from 'lucide-react';
import { recommendationsStore, authStore } from '@/stores';
import type { Recommendation } from '@/types/api';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { Skeleton } from '@/components/Skeleton';
import { Badge } from '@/components/Badge';
import { formatDateTime } from '@/utils/format';
import s from './Recommendations.module.scss';

const TYPE_META: Record<string, { label: string; icon: typeof AlertTriangle; tone: 'warning' | 'info' }> = {
  trainer_load: { label: 'Загрузка тренеров', icon: AlertTriangle, tone: 'warning' },
  weekday_load: { label: 'Расписание', icon: CalendarDays,        tone: 'info' },
};

const Recommendations = observer(() => {
  const isAdmin = authStore.role === 'admin';

  useEffect(() => {
    recommendationsStore.load();
  }, []);

  const grouped = groupByType(recommendationsStore.items);
  const typeKeys = [...grouped.keys()];

  return (
    <Page
      title="Рекомендации"
      subtitle="Загрузка тренеров (<20 сессий за 30 дней) и неравномерность по дням недели"
      actions={isAdmin && (
        <Button
          iconLeft={<RefreshCw size={14} />}
          onClick={() => recommendationsStore.recompute()}
          loading={recommendationsStore.isRecomputing}
        >
          Пересчитать
        </Button>
      )}
    >
      {recommendationsStore.isLoading && recommendationsStore.items.length === 0 ? (
        <Card><Skeleton height={120} /></Card>
      ) : recommendationsStore.items.length === 0 ? (
        <Card>
          <Empty
            title="Активных рекомендаций нет"
            description={isAdmin ? 'Запустите пересчёт, чтобы получить актуальные рекомендации' : 'Все текущие рекомендации применены'}
            icon={<Lightbulb size={28} />}
            action={isAdmin && (
              <Button iconLeft={<RefreshCw size={14} />} onClick={() => recommendationsStore.recompute()} loading={recommendationsStore.isRecomputing}>
                Запустить пересчёт
              </Button>
            )}
          />
        </Card>
      ) : (
        <div className={s.groups}>
          {typeKeys.map(type => {
            const items = grouped.get(type)!;
            const meta = TYPE_META[type] ?? { label: type, icon: Lightbulb, tone: 'info' as const };
            const Icon = meta.icon;
            return (
              <Card
                key={type}
                title={
                  <span className={s.groupTitle}>
                    <Icon size={16} />
                    {meta.label}
                  </span>
                }
                subtitle={`${items.length} ${items.length === 1 ? 'рекомендация' : items.length < 5 ? 'рекомендации' : 'рекомендаций'}`}
              >
                <ul className={s.recList}>
                  {items.map(r => <RecItem key={r.id} rec={r} isAdmin={isAdmin} />)}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
});

function groupByType(items: Recommendation[]): Map<string, Recommendation[]> {
  const map = new Map<string, Recommendation[]>();
  for (const item of items) {
    if (!map.has(item.recommendation_type)) map.set(item.recommendation_type, []);
    map.get(item.recommendation_type)!.push(item);
  }
  return map;
}

const RecItem = observer(({ rec, isAdmin }: { rec: Recommendation; isAdmin: boolean }) => {
  const priorityVariant =
    rec.priority >= 8 ? 'danger' :
    rec.priority >= 6 ? 'warning' : 'info';

  return (
    <li className={s.rec}>
      <div className={s.recBody}>
        <div className={s.recHead}>
          <h4 className={s.recTitle}>{rec.title}</h4>
          <Badge variant={priorityVariant}>P{rec.priority}</Badge>
        </div>
        <p className={s.recDescription}>{rec.description}</p>
        <div className={s.recMeta}>{formatDateTime(rec.created_at)}</div>
      </div>
      {isAdmin && (
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Check size={12} />}
          onClick={() => recommendationsStore.apply(rec.id)}
        >
          Применить
        </Button>
      )}
    </li>
  );
});

export default Recommendations;
