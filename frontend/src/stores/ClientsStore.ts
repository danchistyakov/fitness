import { makeAutoObservable, runInAction } from 'mobx';
import { api, ApiError } from '@/utils/api';
import type {
  Client,
  ClientCreate,
  ClientUpdate,
  ClientsListResponse,
  CreateResponse,
} from '@/types/api';
import { toastStore } from './ToastStore';

type ActivityFilter = 'all' | 'active' | 'inactive';

class ClientsStore {
  clients: Client[] = [];
  total = 0;
  search = '';
  filter: ActivityFilter = 'all';
  isLoading = false;
  error: string | null = null;

  current: Client | null = null;
  isLoadingCurrent = false;

  private _searchDebounce: number | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  setSearch(value: string) {
    this.search = value;
    if (this._searchDebounce) window.clearTimeout(this._searchDebounce);
    this._searchDebounce = window.setTimeout(() => {
      this.load();
    }, 250);
  }

  setFilter(value: ActivityFilter) {
    this.filter = value;
    this.load();
  }

  async load() {
    this.isLoading = true;
    this.error = null;
    try {
      const data = await api.get<ClientsListResponse>('/clients', {
        query: {
          search: this.search || undefined,
          is_active:
            this.filter === 'active'   ? 1 :
            this.filter === 'inactive' ? 0 :
            undefined,
        },
      });
      runInAction(() => {
        this.clients = data.clients;
        this.total = data.total;
      });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки клиентов';
      runInAction(() => { this.error = message; });
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async loadOne(id: number) {
    this.isLoadingCurrent = true;
    try {
      const data = await api.get<Client>(`/clients/${id}`);
      runInAction(() => { this.current = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Клиент не найден';
      toastStore.add(message, 'error');
      runInAction(() => { this.current = null; });
    } finally {
      runInAction(() => { this.isLoadingCurrent = false; });
    }
  }

  async create(payload: ClientCreate): Promise<number | null> {
    try {
      const res = await api.post<CreateResponse>('/clients', payload);
      toastStore.add('Клиент добавлен', 'success');
      await this.load();
      return res.id;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка добавления клиента';
      toastStore.add(message, 'error');
      return null;
    }
  }

  async update(id: number, payload: ClientUpdate): Promise<boolean> {
    try {
      await api.put(`/clients/${id}`, payload);
      toastStore.add('Клиент обновлён', 'success');
      if (this.current?.id === id) await this.loadOne(id);
      await this.load();
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка сохранения';
      toastStore.add(message, 'error');
      return false;
    }
  }

  async deactivate(id: number): Promise<boolean> {
    try {
      await api.delete(`/clients/${id}`);
      toastStore.add('Клиент деактивирован', 'success');
      await this.load();
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка операции';
      toastStore.add(message, 'error');
      return false;
    }
  }

  async assignTrainer(clientId: number, trainerId: number): Promise<boolean> {
    try {
      await api.post(`/clients/${clientId}/assign-trainer`, { trainer_id: trainerId });
      toastStore.add('Тренер назначен', 'success');
      if (this.current?.id === clientId) await this.loadOne(clientId);
      await this.load();
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка назначения тренера';
      toastStore.add(message, 'error');
      return false;
    }
  }
}

export const clientsStore = new ClientsStore();
