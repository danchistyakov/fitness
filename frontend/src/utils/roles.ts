import type { UserRole } from '@/types/api';

// Карта роутов, разрешённых каждой роли. Соответствует ROLE_PAGES из дизайн-спеки.
export const ROLE_PAGES: Record<UserRole, string[]> = {
  admin: [
    'dashboard', 'clients', 'exercises', 'programs', 'sessions',
    'churn', 'segments', 'programs-analytics', 'gym-load', 'recommendations',
    'trainers-accounts',
  ],
  trainer: [
    'dashboard', 'clients', 'exercises', 'programs', 'sessions',
    'churn', 'segments', 'programs-analytics', 'gym-load', 'recommendations',
  ],
  client: ['dashboard', 'clients', 'programs', 'sessions'],
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
  ['/gym-load',           'Загруженность'],
  ['/recommendations',    'Рекомендации'],
  ['/trainers-accounts',  'Аккаунты тренеров'],
  ['/',                   'Дашборд'],
];
