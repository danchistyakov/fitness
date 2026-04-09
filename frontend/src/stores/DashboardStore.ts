import { makeAutoObservable, runInAction } from 'mobx';
import { toastStore } from './ToastStore';

const API = import.meta.env.VITE_API_BASE ?? '/api';

class DashboardStore {
  data: any = null;
  recommendations: any = null;
  isLoading = false;
  isGenerating = false;

  constructor() {
    makeAutoObservable(this);
  }

  async load() {
    this.isLoading = true;
    try {
      const [dashboard, recs] = await Promise.all([
        fetch(`${API}/analytics/dashboard`).then(r => r.json()),
        fetch(`${API}/analytics/recommendations`).then(r => r.json()),
      ]);
      runInAction(() => {
        this.data = dashboard;
        this.recommendations = recs;
      });
    } catch {
      toastStore.add('Ошибка загрузки дашборда', 'error');
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async generateDemoData() {
    this.isGenerating = true;
    try {
      await fetch(`${API}/demo/generate`, { method: 'POST' });
      toastStore.add('Демо-данные сгенерированы', 'success');
      await this.load();
    } catch {
      toastStore.add('Ошибка генерации данных', 'error');
    } finally {
      runInAction(() => { this.isGenerating = false; });
    }
  }

  get isEmpty() {
    return !this.data || this.data.summary?.total_clients === 0;
  }
}

export const dashboardStore = new DashboardStore();
