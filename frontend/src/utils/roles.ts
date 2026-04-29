import type { UserRole } from '@/types/api';

// Карта роутов, разрешённых каждой роли. Соответствует ROLE_PAGES из дизайн-спеки.
export const ROLE_PAGES: Record<UserRole, string[]> = {
  admin: [
    'dashboard', 'clients', 'exercises', 'programs', 'sessions',
    'churn', 'segments', 'programs-analytics', 'recommendations', 'access',
    'trainers-accounts',
  ],
  trainer: [
    'dashboard', 'clients', 'exercises', 'programs', 'sessions',
    'churn', 'recommendations',
  ],
  client: ['dashboard', 'programs'],
};

// Заголовки страниц для мобильного хедера. Порядок важен — длинные префиксы первее.
export const ROUTE_TITLES: ReadonlyArray<readonly [string, string]> = [
  ['/clients',            'Клиенты'],
  ['/exercises',          'Упражнения'],
  ['/programs-analytics', 'Сравнение программ'],
  ['/programs',           'Программы'],
  ['/sessions',           'Тренировки'],
  ['/churn',              'Анализ оттока'],
  ['/segments',           'Сегменты'],
  ['/recommendations',    'Рекомендации'],
  ['/trainers-accounts',  'Аккаунты тренеров'],
  ['/access',             'Права доступа'],
  ['/',                   'Дашборд'],
];
