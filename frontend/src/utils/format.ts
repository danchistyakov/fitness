// Утилиты форматирования и подписи статусов на русском.

export function formatNumber(num: number | null | undefined, decimals = 0): string {
  if (num === null || num === undefined || Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatPercent(num: number | null | undefined, decimals = 1): string {
  if (num === null || num === undefined || Number.isNaN(num)) return '—';
  return `${formatNumber(num, decimals)}%`;
}

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPValue(p: number | null | undefined): string {
  if (p === null || p === undefined) return '—';
  if (p < 0.001) return 'p < 0.001';
  return `p = ${p.toFixed(3)}`;
}

export const subscriptionLabels: Record<string, string> = {
  basic:    'Базовый',
  standard: 'Стандарт',
  premium:  'Премиум',
  vip:      'VIP',
};

export const goalLabels: Record<string, string> = {
  weight_loss:     'Похудение',
  muscle_gain:     'Набор массы',
  endurance:       'Выносливость',
  flexibility:     'Гибкость',
  general_fitness: 'Общая форма',
};

export const levelLabels: Record<string, string> = {
  beginner:     'Новичок',
  intermediate: 'Средний',
  advanced:     'Продвинутый',
};

export const difficultyLabels: Record<string, string> = {
  easy:   'Лёгкое',
  medium: 'Среднее',
  hard:   'Сложное',
};

export const riskLabels: Record<string, string> = {
  low:    'Низкий',
  medium: 'Средний',
  high:   'Высокий',
};

export const roleLabels: Record<string, string> = {
  admin:   'Администратор',
  trainer: 'Тренер',
  client:  'Клиент',
};

export const metricLabels: Record<string, string> = {
  weight:               'Вес, кг',
  body_fat_percentage:  '% жира',
  muscle_mass:          'Мышечная масса, кг',
  chest_cm:             'Грудь, см',
  waist_cm:             'Талия, см',
  hips_cm:              'Бёдра, см',
  biceps_cm:            'Бицепс, см',
  thighs_cm:            'Бедро, см',
  resting_heart_rate:   'Пульс покоя',
  max_pushups:          'Отжимания',
  max_pullups:          'Подтягивания',
  plank_seconds:        'Планка, с',
  run_5km_minutes:      '5 км, мин',
};

export const weekdayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function clusterColor(idx: number): string {
  const palette = [
    'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
    'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)',
  ];
  return palette[idx % palette.length];
}
