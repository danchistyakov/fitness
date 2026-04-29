import { makeAutoObservable, runInAction } from 'mobx';
import { api, ApiError } from '@/utils/api';
import type { ClientGoal, ClientGoalCreate, CreateResponse } from '@/types/api';
import { toastStore } from './ToastStore';

class GoalsStore {
  goals: ClientGoal[] = [];
  clientId: number | null = null;
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async load(clientId: number) {
    this.isLoading = true;
    this.clientId = clientId;
    try {
      const data = await api.get<ClientGoal[]>(`/goals/${clientId}`);
      runInAction(() => { this.goals = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки целей';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async create(payload: ClientGoalCreate): Promise<number | null> {
    try {
      const res = await api.post<CreateResponse>('/goals', payload);
      toastStore.add('Цель добавлена', 'success');
      if (this.clientId === payload.client_id) await this.load(payload.client_id);
      return res.id;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка добавления цели';
      toastStore.add(message, 'error');
      return null;
    }
  }

  async markAchieved(goalId: number): Promise<boolean> {
    try {
      await api.post(`/goals/${goalId}/achieve`);
      toastStore.add('Цель отмечена как достигнутая', 'success');
      if (this.clientId !== null) await this.load(this.clientId);
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка обновления';
      toastStore.add(message, 'error');
      return false;
    }
  }
}

export const goalsStore = new GoalsStore();
