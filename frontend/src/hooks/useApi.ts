import { useState, useCallback, useRef, useEffect } from 'react';
import { toastStore } from '../stores/ToastStore';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

// Простой кэш для запросов
const cache = new Map();
const CACHE_TTL = 30000; // 30 секунд

// Отслеживание активных запросов для предотвращения дублей
const pendingRequests = new Map();

// Генерация ключа кэша
const getCacheKey = (endpoint, options = {}) => {
  return `${options.method || 'GET'}:${endpoint}`;
};

// Проверка валидности кэша
const isCacheValid = (entry) => {
  return entry && (Date.now() - entry.timestamp) < CACHE_TTL;
};

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const request = useCallback(async (endpoint, options = {}) => {
    const cacheKey = getCacheKey(endpoint, options);
    const isGetRequest = !options.method || options.method === 'GET';

    // Для GET запросов проверяем кэш
    if (isGetRequest && !options.skipCache) {
      const cached = cache.get(cacheKey);
      if (isCacheValid(cached)) {
        return cached.data;
      }
    }

    // Проверяем, есть ли уже такой же запрос в процессе
    if (isGetRequest && pendingRequests.has(cacheKey)) {
      try {
        return await pendingRequests.get(cacheKey);
      } catch (err) {
        throw err;
      }
    }

    // Отменяем предыдущий запрос если нужно
    if (abortControllerRef.current && options.cancelPrevious) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const fetchPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          signal: abortControllerRef.current.signal,
          ...options,
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
        if (err.name === 'AbortError') {
          // Запрос был отменён — не показываем ошибку
          return null;
        }

        const errorMessage = err.message || 'Произошла ошибка при загрузке данных';
        setError(errorMessage);
        setLoading(false);

        // Показываем toast с ошибкой
        if (!options.silent) {
          toastStore.add(errorMessage, 'error');
        }

        throw err;
      } finally {
        pendingRequests.delete(cacheKey);
      }
    })();

    // Сохраняем промис для предотвращения дублей
    if (isGetRequest) {
      pendingRequests.set(cacheKey, fetchPromise);
    }

    return fetchPromise;
  }, []);

  const get = useCallback((endpoint, options = {}) =>
    request(endpoint, { ...options, method: 'GET' }), [request]);

  const post = useCallback((endpoint, data, options = {}) =>
    request(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) }), [request]);

  const put = useCallback((endpoint, data, options = {}) =>
    request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) }), [request]);

  const del = useCallback((endpoint, options = {}) =>
    request(endpoint, { ...options, method: 'DELETE' }), [request]);

  // Очистка кэша
  const clearCache = useCallback((endpoint) => {
    if (endpoint) {
      cache.delete(getCacheKey(endpoint));
    } else {
      cache.clear();
    }
  }, []);

  // Инвалидация кэша после мутации
  const invalidateCache = useCallback((patterns = []) => {
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

  return {
    get,
    post,
    put,
    del,
    loading,
    error,
    clearCache,
    invalidateCache
  };
};

// Format numbers
export const formatNumber = (num, decimals = 0) => {
  if (num === null || num === undefined) return '—';
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

// Format currency
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date
export const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// Subscription type labels
export const subscriptionLabels = {
  basic: 'Базовый',
  standard: 'Стандарт',
  premium: 'Премиум',
  vip: 'VIP',
};

// Goal labels
export const goalLabels = {
  weight_loss: 'Похудение',
  muscle_gain: 'Набор массы',
  endurance: 'Выносливость',
  flexibility: 'Гибкость',
  general_fitness: 'Общая форма',
};

// Level labels
export const levelLabels = {
  beginner: 'Новичок',
  intermediate: 'Средний',
  advanced: 'Продвинутый',
};

// Risk level labels
export const riskLabels = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};