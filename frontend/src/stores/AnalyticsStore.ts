import { makeAutoObservable, observable, runInAction } from 'mobx';
import { api, ApiError } from '@/utils/api';
import type {
  ChurnAnalyticsData,
  ClientAnalytics,
  ProgramsAnalyticsData,
  ProgramsMetric,
  SegmentsData,
  GymLoadData,
} from '@/types/api';
import { toastStore } from './ToastStore';

class AnalyticsStore {
  churn: ChurnAnalyticsData | null = null;
  isLoadingChurn = false;

  segments: SegmentsData | null = null;
  isLoadingSegments = false;
  segmentsK = 4;

  programs: ProgramsAnalyticsData | null = null;
  isLoadingPrograms = false;
  programsMetric: ProgramsMetric = 'weight_change';

  clientAnalytics: ClientAnalytics | null = null;
  isLoadingClient = false;

  gymLoad: GymLoadData | null = null;
  isLoadingGymLoad = false;

  constructor() {
    makeAutoObservable(this, {
      churn: observable.ref,
      segments: observable.ref,
      programs: observable.ref,
      clientAnalytics: observable.ref,
      gymLoad: observable.ref,
    });
  }

  async loadChurn() {
    this.isLoadingChurn = true;
    try {
      const data = await api.get<ChurnAnalyticsData>('/analytics/churn');
      runInAction(() => { this.churn = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки аналитики оттока';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoadingChurn = false; });
    }
  }

  setSegmentsK(k: number) {
    this.segmentsK = Math.max(2, Math.min(8, k));
    this.loadSegments();
  }

  async loadSegments() {
    this.isLoadingSegments = true;
    try {
      const data = await api.get<SegmentsData>('/analytics/segments', {
        query: { k: this.segmentsK },
      });
      runInAction(() => { this.segments = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки сегментов';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoadingSegments = false; });
    }
  }

  setProgramsMetric(metric: ProgramsMetric) {
    this.programsMetric = metric;
    this.loadPrograms();
  }

  async loadPrograms() {
    this.isLoadingPrograms = true;
    try {
      const data = await api.get<ProgramsAnalyticsData>('/analytics/programs', {
        query: { metric: this.programsMetric },
      });
      runInAction(() => { this.programs = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки сравнения программ';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoadingPrograms = false; });
    }
  }

  async loadClient(clientId: number) {
    this.isLoadingClient = true;
    try {
      const data = await api.get<ClientAnalytics>(`/analytics/client/${clientId}`);
      runInAction(() => { this.clientAnalytics = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки аналитики клиента';
      toastStore.add(message, 'error');
      runInAction(() => { this.clientAnalytics = null; });
    } finally {
      runInAction(() => { this.isLoadingClient = false; });
    }
  }

  async loadGymLoad() {
    this.isLoadingGymLoad = true;
    try {
      const data = await api.get<GymLoadData>('/analytics/gym-load');
      runInAction(() => { this.gymLoad = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки загруженности зала';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoadingGymLoad = false; });
    }
  }
}

export const analyticsStore = new AnalyticsStore();
