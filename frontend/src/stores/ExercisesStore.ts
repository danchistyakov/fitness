import { makeAutoObservable, runInAction } from 'mobx';
import { api, ApiError } from '@/utils/api';
import type { Exercise, ExerciseCreate, CreateResponse } from '@/types/api';
import { toastStore } from './ToastStore';

interface ListFilters {
  muscle_group?: string;
  load_type?: string;
  difficulty?: string;
  search?: string;
}

class ExercisesStore {
  exercises: Exercise[] = [];
  isLoading = false;
  filters: ListFilters = {};

  constructor() {
    makeAutoObservable(this);
  }

  setFilter<K extends keyof ListFilters>(key: K, value: ListFilters[K]) {
    this.filters = { ...this.filters, [key]: value || undefined };
    this.load();
  }

  async load() {
    this.isLoading = true;
    try {
      const data = await api.get<Exercise[]>('/exercises', {
        query: this.filters as Record<string, string | undefined>,
      });
      runInAction(() => { this.exercises = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки упражнений';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async create(payload: ExerciseCreate): Promise<number | null> {
    try {
      const res = await api.post<CreateResponse>('/exercises', payload);
      toastStore.add('Упражнение добавлено', 'success');
      await this.load();
      return res.id;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка добавления';
      toastStore.add(message, 'error');
      return null;
    }
  }

  async update(id: number, payload: Partial<ExerciseCreate>): Promise<boolean> {
    try {
      await api.put(`/exercises/${id}`, payload);
      toastStore.add('Упражнение обновлено', 'success');
      await this.load();
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка обновления';
      toastStore.add(message, 'error');
      return false;
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      await api.delete(`/exercises/${id}`);
      toastStore.add('Упражнение удалено', 'success');
      await this.load();
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка удаления';
      toastStore.add(message, 'error');
      return false;
    }
  }

  get muscleGroups(): string[] {
    return [
      ...new Set(this.exercises.map(e => e.muscle_group).filter((g): g is string => !!g)),
    ].sort();
  }

  get loadTypes(): string[] {
    return [
      ...new Set(this.exercises.map(e => e.load_type).filter((t): t is string => !!t)),
    ].sort();
  }
}

export const exercisesStore = new ExercisesStore();
