import { makeAutoObservable, runInAction } from 'mobx';
import { api, ApiError } from '@/utils/api';
import type { Recommendation } from '@/types/api';
import { toastStore } from './ToastStore';

class RecommendationsStore {
  items: Recommendation[] = [];
  isLoading = false;
  isRecomputing = false;

  constructor() {
    makeAutoObservable(this);
  }

  async load(includeApplied = false) {
    this.isLoading = true;
    try {
      const data = await api.get<Recommendation[]>('/recommendations', {
        query: { include_applied: includeApplied ? 1 : 0 },
      });
      runInAction(() => { this.items = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки рекомендаций';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async recompute() {
    this.isRecomputing = true;
    try {
      const res = await api.post<{ count: number }>('/recommendations/recompute');
      toastStore.add(`Пересчёт завершён: ${res.count} рекомендаций`, 'success');
      await this.load();
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка пересчёта';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isRecomputing = false; });
    }
  }

  async apply(id: number): Promise<boolean> {
    try {
      await api.post(`/recommendations/${id}/apply`);
      runInAction(() => {
        this.items = this.items.filter(r => r.id !== id);
      });
      toastStore.add('Рекомендация применена', 'success');
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка применения';
      toastStore.add(message, 'error');
      return false;
    }
  }
}

export const recommendationsStore = new RecommendationsStore();
