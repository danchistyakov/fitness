import { makeAutoObservable, runInAction } from 'mobx';

const API = import.meta.env.VITE_API_BASE ?? '/api';
const STORAGE_KEY = 'fit_auth';

export interface AuthUser {
  id: number;
  login: string;
  role: 'admin' | 'trainer' | 'client';
  full_name: string;
  trainer_id: number | null;
  client_id: number | null;
}

class AuthStore {
  user: AuthUser | null = null;
  token: string | null = null;
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
    this._restoreSession();
  }

  get isAuthenticated() {
    return !!this.user && !!this.token;
  }

  get role(): AuthUser['role'] | null {
    return this.user?.role ?? null;
  }

  private _restoreSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const { user, token } = JSON.parse(raw);
      this.user = user;
      this.token = token;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private _persist() {
    if (this.user && this.token) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: this.user, token: this.token }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  async login(login: string, password: string) {
    this.isLoading = true;
    this.error = null;
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Неверный логин или пароль');
      }
      const data = await res.json();
      runInAction(() => {
        this.user = data.user;
        this.token = data.token;
        this._persist();
      });
    } catch (e: any) {
      runInAction(() => { this.error = e.message; });
      throw e;
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async logout() {
    if (this.token) {
      fetch(`${API}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
      }).catch(() => {});
    }
    this.user = null;
    this.token = null;
    this._persist();
  }
}

export const authStore = new AuthStore();
