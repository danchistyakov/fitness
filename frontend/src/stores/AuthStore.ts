import { makeAutoObservable, runInAction } from 'mobx';
import { api, ApiError, configureApi } from '@/utils/api';
import type { AuthUser, LoginResponse } from '@/types/api';

const STORAGE_KEY = 'fit_auth';

class AuthStore {
  user: AuthUser | null = null;
  token: string | null = null;
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
    this._restoreSession();
    configureApi({
      getToken: () => this.token,
      onUnauthorized: () => this._handleUnauthorized(),
    });
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
      const parsed = JSON.parse(raw) as { user: AuthUser; token: string };
      this.user = parsed.user;
      this.token = parsed.token;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private _persist() {
    if (this.user && this.token) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user: this.user, token: this.token }),
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private _handleUnauthorized() {
    runInAction(() => {
      this.user = null;
      this.token = null;
      this._persist();
    });
  }

  async login(login: string, password: string): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      const data = await api.post<LoginResponse>('/auth/login', { login, password });
      runInAction(() => {
        this.user = data.user;
        this.token = data.token;
        this._persist();
      });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка входа';
      runInAction(() => { this.error = message; });
      throw e;
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async logout(): Promise<void> {
    if (this.token) {
      api.post('/auth/logout').catch(() => { /* ignore */ });
    }
    this._handleUnauthorized();
  }
}

export const authStore = new AuthStore();
