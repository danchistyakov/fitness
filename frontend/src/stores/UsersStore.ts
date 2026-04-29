import { makeAutoObservable, runInAction } from 'mobx';
import { api, ApiError } from '@/utils/api';
import type { User, UserCreate, UserUpdate, CreateResponse } from '@/types/api';
import { toastStore } from './ToastStore';

class UsersStore {
  users: User[] = [];
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  async load() {
    this.isLoading = true;
    try {
      const data = await api.get<User[]>('/users');
      runInAction(() => { this.users = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки пользователей';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async create(payload: UserCreate): Promise<number | null> {
    try {
      const res = await api.post<CreateResponse>('/users', payload);
      toastStore.add('Пользователь создан', 'success');
      await this.load();
      return res.id;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка создания';
      toastStore.add(message, 'error');
      return null;
    }
  }

  async update(id: number, payload: UserUpdate): Promise<boolean> {
    try {
      await api.put(`/users/${id}`, payload);
      toastStore.add('Пользователь обновлён', 'success');
      await this.load();
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка обновления';
      toastStore.add(message, 'error');
      return false;
    }
  }

  async deactivate(id: number): Promise<boolean> {
    try {
      await api.delete(`/users/${id}`);
      toastStore.add('Пользователь деактивирован', 'success');
      await this.load();
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка операции';
      toastStore.add(message, 'error');
      return false;
    }
  }
}

export const usersStore = new UsersStore();
