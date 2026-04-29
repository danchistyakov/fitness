import { makeAutoObservable, runInAction } from 'mobx';
import { api, ApiError } from '@/utils/api';
import type { ClientMetrics, ClientMetricsCreate, CreateResponse } from '@/types/api';
import { toastStore } from './ToastStore';

class MetricsStore {
  metrics: ClientMetrics[] = [];
  clientId: number | null = null;
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async load(clientId: number) {
    this.isLoading = true;
    this.clientId = clientId;
    try {
      const data = await api.get<ClientMetrics[]>(`/metrics/${clientId}`);
      runInAction(() => { this.metrics = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки метрик';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async create(payload: ClientMetricsCreate): Promise<number | null> {
    try {
      const res = await api.post<CreateResponse>('/metrics', payload);
      toastStore.add('Замер добавлен', 'success');
      if (this.clientId === payload.client_id) await this.load(payload.client_id);
      return res.id;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка добавления';
      toastStore.add(message, 'error');
      return null;
    }
  }
}

export const metricsStore = new MetricsStore();
