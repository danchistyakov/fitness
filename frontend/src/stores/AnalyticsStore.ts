import { makeAutoObservable, runInAction } from 'mobx';
import { toastStore } from './ToastStore';

const API = import.meta.env.VITE_API_BASE ?? '/api';

class AnalyticsStore {
  // Programs
  programsData: any = null;
  isLoadingPrograms = false;

  // Revenue
  revenueData: any = null;
  isLoadingRevenue = false;

  // Churn
  churnData: any = null;
  isLoadingChurn = false;

  // Recommendations
  recommendationsData: any = null;
  isLoadingRecommendations = false;

  constructor() {
    makeAutoObservable(this);
  }

  async loadPrograms() {
    if (this.isLoadingPrograms) return;
    this.isLoadingPrograms = true;
    try {
      const data = await fetch(`${API}/analytics/programs`).then(r => r.json());
      runInAction(() => { this.programsData = data; });
    } catch {
      toastStore.add('Ошибка загрузки программ', 'error');
    } finally {
      runInAction(() => { this.isLoadingPrograms = false; });
    }
  }

  async loadRevenue() {
    if (this.isLoadingRevenue) return;
    this.isLoadingRevenue = true;
    try {
      const data = await fetch(`${API}/analytics/revenue`).then(r => r.json());
      runInAction(() => { this.revenueData = data; });
    } catch {
      toastStore.add('Ошибка загрузки финансов', 'error');
    } finally {
      runInAction(() => { this.isLoadingRevenue = false; });
    }
  }

  async loadChurn() {
    if (this.isLoadingChurn) return;
    this.isLoadingChurn = true;
    try {
      const data = await fetch(`${API}/analytics/churn`).then(r => r.json());
      runInAction(() => { this.churnData = data; });
    } catch {
      toastStore.add('Ошибка загрузки аналитики оттока', 'error');
    } finally {
      runInAction(() => { this.isLoadingChurn = false; });
    }
  }

  async loadRecommendations(skipCache = false) {
    if (this.isLoadingRecommendations) return;
    if (!skipCache && this.recommendationsData) return;
    this.isLoadingRecommendations = true;
    try {
      const data = await fetch(`${API}/analytics/recommendations`).then(r => r.json());
      runInAction(() => { this.recommendationsData = data; });
    } catch {
      toastStore.add('Ошибка загрузки рекомендаций', 'error');
    } finally {
      runInAction(() => { this.isLoadingRecommendations = false; });
    }
  }
}

export const analyticsStore = new AnalyticsStore();
