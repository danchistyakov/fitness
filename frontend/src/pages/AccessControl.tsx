import { Shield, UserCheck, User, Check, Minus } from 'lucide-react';
import { Page } from '@/components/Page';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { ROLE_PAGES } from '@/utils/roles';
import s from './AccessControl.module.scss';

const ROLE_META = {
  admin:   { label: 'Администратор', icon: Shield,    color: 'var(--success)' },
  trainer: { label: 'Тренер',        icon: UserCheck, color: 'var(--info)' },
  client:  { label: 'Клиент',        icon: User,      color: 'var(--purple)' },
} as const;

const PAGE_LABELS: Record<string, string> = {
  dashboard:           'Дашборд',
  clients:             'Клиенты',
  exercises:           'Упражнения',
  programs:            'Программы',
  sessions:            'Тренировки',
  churn:               'Анализ оттока',
  segments:            'Сегменты',
  'programs-analytics':'Сравнение программ',
  recommendations:     'Рекомендации',
  access:              'Права доступа',
};

const ALL_PAGES = Object.keys(PAGE_LABELS);

export default function AccessControl() {
  return (
    <Page
      title="Права доступа"
      subtitle="Ролевая модель доступа: admin / trainer / client. Серверная проверка на каждом эндпоинте."
    >
      <Card title="Матрица доступа" subtitle="Какие разделы доступны каждой роли">
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Раздел</th>
                {(Object.keys(ROLE_META) as Array<keyof typeof ROLE_META>).map(r => {
                  const meta = ROLE_META[r];
                  const Icon = meta.icon;
                  return (
                    <th key={r} style={{ textAlign: 'center' }}>
                      <span className={s.roleHeader} style={{ color: meta.color }}>
                        <Icon size={14} />
                        {meta.label}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ALL_PAGES.map(page => (
                <tr key={page}>
                  <td className={s.pageCell}>{PAGE_LABELS[page]}</td>
                  {(Object.keys(ROLE_META) as Array<keyof typeof ROLE_META>).map(r => (
                    <td key={r} className={s.markCell}>
                      {ROLE_PAGES[r].includes(page)
                        ? <Check size={14} className={s.allowed} />
                        : <Minus size={14} className={s.denied} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Описание ролей">
        <ul className={s.rolesList}>
          {(Object.keys(ROLE_META) as Array<keyof typeof ROLE_META>).map(r => {
            const meta = ROLE_META[r];
            const Icon = meta.icon;
            const allowed = ROLE_PAGES[r];
            return (
              <li key={r} className={s.role}>
                <div className={s.roleIcon} style={{ background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, color: meta.color }}>
                  <Icon size={18} />
                </div>
                <div className={s.roleBody}>
                  <div className={s.roleName} style={{ color: meta.color }}>{meta.label}</div>
                  <div className={s.roleDesc}>
                    Доступ к {allowed.length} разделам:&nbsp;
                    {allowed.map(p => <Badge key={p} variant="neutral" size="sm">{PAGE_LABELS[p]}</Badge>).reduce<React.ReactNode[]>((acc, b, i) => {
                      if (i > 0) acc.push(' ');
                      acc.push(b);
                      return acc;
                    }, [])}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Журнал аудита">
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
          Каждое действие, изменяющее данные (login/logout/create/update/delete), записывается в системную
          таблицу <code style={{ background: 'var(--bg-2)', padding: '2px 6px', borderRadius: 4, fontFamily: 'inherit' }}>audit_log</code>.
          Чтение журнала ограничено ролью <strong>admin</strong> на стороне API.
          Просмотр через UI в текущем релизе не реализован.
        </p>
      </Card>
    </Page>
  );
}
