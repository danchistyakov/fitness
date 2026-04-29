import { makeAutoObservable, runInAction } from 'mobx';
import { api, ApiError } from '@/utils/api';
import type { Trainer, TrainerCreate, CreateResponse } from '@/types/api';
import { toastStore } from './ToastStore';

class TrainersStore {
  trainers: Trainer[] = [];
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async load() {
    this.isLoading = true;
    try {
      const data = await api.get<Trainer[]>('/trainers');
      runInAction(() => { this.trainers = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки тренеров';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async create(payload: TrainerCreate): Promise<number | null> {
    try {
      const res = await api.post<CreateResponse>('/trainers', payload);
      toastStore.add('Тренер добавлен', 'success');
      await this.load();
      return res.id;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка добавления';
      toastStore.add(message, 'error');
      return null;
    }
  }
}

export const trainersStore = new TrainersStore();
