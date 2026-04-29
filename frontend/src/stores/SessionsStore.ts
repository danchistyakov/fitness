import { makeAutoObservable, runInAction } from 'mobx';
import { api, ApiError } from '@/utils/api';
import type {
  Session,
  SessionCreate,
  SessionExercise,
  SessionExerciseCreate,
  CreateResponse,
} from '@/types/api';
import { toastStore } from './ToastStore';

interface SessionFilters {
  client_id?: number;
  date_from?: string;
  date_to?: string;
}

class SessionsStore {
  sessions: Session[] = [];
  isLoading = false;
  filters: SessionFilters = {};

  sessionExercises: SessionExercise[] = [];
  isLoadingExercises = false;
  currentSessionId: number | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  setFilter<K extends keyof SessionFilters>(key: K, value: SessionFilters[K]) {
    this.filters = { ...this.filters, [key]: (value || undefined) as SessionFilters[K] };
    this.load();
  }

  async load() {
    this.isLoading = true;
    try {
      const data = await api.get<Session[]>('/sessions', {
        query: this.filters as Record<string, string | number | undefined>,
      });
      runInAction(() => { this.sessions = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки тренировок';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async create(payload: SessionCreate): Promise<number | null> {
    try {
      const res = await api.post<CreateResponse>('/sessions', payload);
      toastStore.add('Тренировка записана', 'success');
      await this.load();
      return res.id;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка создания';
      toastStore.add(message, 'error');
      return null;
    }
  }

  async loadExercises(sessionId: number) {
    this.isLoadingExercises = true;
    this.currentSessionId = sessionId;
    try {
      const data = await api.get<SessionExercise[]>(`/sessions/${sessionId}/exercises`);
      runInAction(() => { this.sessionExercises = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки упражнений';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoadingExercises = false; });
    }
  }

  async addExercise(sessionId: number, payload: SessionExerciseCreate): Promise<boolean> {
    try {
      await api.post(`/sessions/${sessionId}/exercises`, payload);
      await this.loadExercises(sessionId);
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка добавления';
      toastStore.add(message, 'error');
      return false;
    }
  }
}

export const sessionsStore = new SessionsStore();
