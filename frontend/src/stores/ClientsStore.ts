import { makeAutoObservable, runInAction } from 'mobx';
import { toastStore } from './ToastStore';

const API = import.meta.env.VITE_API_BASE ?? '/api';

class ClientsStore {
  clients: any[] = [];
  total = 0;
  search = '';
  filter: 'all' | 'active' | 'inactive' = 'all';
  isLoading = false;

  selectedClientId: number | null = null;
  clientAnalytics: any = null;
  isLoadingAnalytics = false;

  constructor() {
    makeAutoObservable(this);
  }

  setSearch(value: string) {
    this.search = value;
    this.loadClients();
  }

  setFilter(value: 'all' | 'active' | 'inactive') {
    this.filter = value;
    this.loadClients();
  }

  async loadClients() {
    this.isLoading = true;
    try {
      const params = new URLSearchParams();
      if (this.search) params.set('search', this.search);
      if (this.filter === 'active') params.set('is_active', '1');
      if (this.filter === 'inactive') params.set('is_active', '0');

      const data = await fetch(`${API}/clients?${params}`).then(r => r.json());
      runInAction(() => {
        this.clients = data.clients;
        this.total = data.total;
      });
    } catch {
      toastStore.add('Ошибка загрузки клиентов', 'error');
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async addClient(clientData: Record<string, unknown>) {
    try {
      const res = await fetch(`${API}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.add('Клиент добавлен', 'success');
      await this.loadClients();
    } catch {
      toastStore.add('Ошибка добавления клиента', 'error');
      throw new Error('add failed');
    }
  }

  selectClient(id: number | null) {
    this.selectedClientId = id;
    this.clientAnalytics = null;
    if (id !== null) this.loadClientAnalytics(id);
  }

  async loadClientAnalytics(id: number) {
    this.isLoadingAnalytics = true;
    try {
      const data = await fetch(`${API}/analytics/client/${id}`).then(r => r.json());
      runInAction(() => { this.clientAnalytics = data; });
    } catch {
      toastStore.add('Ошибка загрузки профиля клиента', 'error');
    } finally {
      runInAction(() => { this.isLoadingAnalytics = false; });
    }
  }
}

export const clientsStore = new ClientsStore();
