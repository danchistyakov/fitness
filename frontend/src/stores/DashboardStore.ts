import { makeAutoObservable, observable, runInAction } from 'mobx';
import { api, ApiError } from '@/utils/api';
import type { DashboardData } from '@/types/api';
import { toastStore } from './ToastStore';

class DashboardStore {
  data: DashboardData | null = null;
  isLoading = false;
  isGenerating = false;

  constructor() {
    makeAutoObservable(this, { data: observable.ref });
  }

  async load() {
    this.isLoading = true;
    try {
      const data = await api.get<DashboardData>('/analytics/dashboard');
      runInAction(() => { this.data = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки дашборда';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async generateDemoData() {
    this.isGenerating = true;
    try {
      await api.post('/demo/generate');
      toastStore.add('Демо-данные сгенерированы', 'success');
      await this.load();
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка генерации';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isGenerating = false; });
    }
  }

  get isEmpty() {
    return !this.data || this.data.summary.active_clients === 0;
  }
}

export const dashboardStore = new DashboardStore();
