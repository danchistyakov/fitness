import { useState, useCallback, useRef, useEffect } from 'react';
import { toastStore } from '../stores/ToastStore';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  skipCache?: boolean;
  cancelPrevious?: boolean;
  silent?: boolean;
}

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

// Простой кэш для запросов
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 секунд

// Отслеживание активных запросов для предотвращения дублей
const pendingRequests = new Map<string, Promise<unknown>>();

// Генерация ключа кэша
const getCacheKey = (endpoint: string, options: RequestOptions = {}): string => {
  return `${options.method || 'GET'}:${endpoint}`;
};

// Проверка валидности кэша
const isCacheValid = (entry: CacheEntry | undefined): boolean => {
  return !!entry && (Date.now() - entry.timestamp) < CACHE_TTL;
};

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const request = useCallback(async (endpoint: string, options: RequestOptions = {}): Promise<unknown> => {
    const cacheKey = getCacheKey(endpoint, options);
    const isGetRequest = !options.method || options.method === 'GET';

    // Для GET запросов проверяем кэш
    if (isGetRequest && !options.skipCache) {
      const cached = cache.get(cacheKey);
      if (isCacheValid(cached)) {
        return cached!.data;
      }
    }

    // Проверяем, есть ли уже такой же запрос в процессе
    if (isGetRequest && pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey);
    }

    // Отменяем предыдущий запрос если нужно
    if (abortControllerRef.current && options.cancelPrevious) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const fetchPromise: Promise<unknown> = (async () => {
      try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          signal: abortControllerRef.current!.signal,
          method: options.method,
          body: options.body,
        });

        if (!response.ok) {
          let errorMessage = `Ошибка сервера: ${response.status}`;

          try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorData.message || errorMessage;
          } catch {
            // Не удалось распарсить JSON ошибки
          }

          throw new Error(errorMessage);
        }

        const data = await response.json();

        // Кэшируем только GET запросы
        if (isGetRequest) {
          cache.set(cacheKey, { data, timestamp: Date.now() });
        }

        setLoading(false);
        return data;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }

        const errorMessage = err instanceof Error ? err.message : 'Произошла ошибка при загрузке данных';
        setError(errorMessage);
        setLoading(false);

        if (!options.silent) {
          toastStore.add(errorMessage, 'error');
        }

        throw err;
      } finally {
        pendingRequests.delete(cacheKey);
      }
    })();

    if (isGetRequest) {
      pendingRequests.set(cacheKey, fetchPromise);
    }

    return fetchPromise;
  }, []);

  const get = useCallback((endpoint: string, options: RequestOptions = {}) =>
    request(endpoint, { ...options, method: 'GET' }), [request]);

  const post = useCallback((endpoint: string, data: unknown, options: RequestOptions = {}) =>
    request(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) }), [request]);

  const put = useCallback((endpoint: string, data: unknown, options: RequestOptions = {}) =>
    request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) }), [request]);

  const del = useCallback((endpoint: string, options: RequestOptions = {}) =>
    request(endpoint, { ...options, method: 'DELETE' }), [request]);

  const clearCache = useCallback((endpoint?: string) => {
    if (endpoint) {
      cache.delete(getCacheKey(endpoint));
    } else {
      cache.clear();
    }
  }, []);

  const invalidateCache = useCallback((patterns: string[] = []) => {
    if (patterns.length === 0) {
      cache.clear();
    } else {
      for (const key of cache.keys()) {
        if (patterns.some(pattern => key.includes(pattern))) {
          cache.delete(key);
        }
      }
    }
  }, []);

  return { get, post, put, del, loading, error, clearCache, invalidateCache };
};

// Format numbers
export const formatNumber = (num: number | null | undefined, decimals = 0): string => {
  if (num === null || num === undefined) return '—';
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

// Format currency
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// Subscription type labels
export const subscriptionLabels: Record<string, string> = {
  basic: 'Базовый',
  standard: 'Стандарт',
  premium: 'Премиум',
  vip: 'VIP',
};

// Goal labels
export const goalLabels: Record<string, string> = {
  weight_loss: 'Похудение',
  muscle_gain: 'Набор массы',
  endurance: 'Выносливость',
  flexibility: 'Гибкость',
  general_fitness: 'Общая форма',
};

// Level labels
export const levelLabels: Record<string, string> = {
  beginner: 'Новичок',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
};

// Risk level labels
export const riskLabels: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};
