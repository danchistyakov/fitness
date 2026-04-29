import { makeAutoObservable, runInAction } from 'mobx';
import { api, ApiError } from '@/utils/api';
import type {
  Program,
  ProgramCreate,
  ProgramExercise,
  ProgramExerciseCreate,
  CreateResponse,
  CalendarItem,
} from '@/types/api';
import { toastStore } from './ToastStore';

class ProgramsStore {
  programs: Program[] = [];
  isLoading = false;
  search = '';

  programExercises: ProgramExercise[] = [];
  isLoadingExercises = false;
  currentProgramId: number | null = null;
  calendar: CalendarItem[] = [];
  isLoadingCalendar = false;

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

  async load(clientId?: number) {
    this.isLoading = true;
    try {
      const data = await api.get<Program[]>('/programs', {
        query: {
          client_id: clientId,
          search: this.search || undefined,
        },
      });
      runInAction(() => { this.programs = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки программ';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoading = false; });
    }
  }

  async create(payload: ProgramCreate): Promise<number | null> {
    try {
      const res = await api.post<CreateResponse>('/programs', payload);
      toastStore.add('Программа создана', 'success');
      await this.load();
      return res.id;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка создания';
      toastStore.add(message, 'error');
      return null;
    }
  }

  async copy(programId: number, targetClientId: number): Promise<number | null> {
    try {
      const res = await api.post<{ id: number; source_id: number }>(
        `/programs/${programId}/copy`,
        undefined,
        { query: { target_client_id: targetClientId } },
      );
      toastStore.add('Программа скопирована', 'success');
      await this.load();
      return res.id;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка копирования';
      toastStore.add(message, 'error');
      return null;
    }
  }

  async loadExercises(programId: number) {
    this.isLoadingExercises = true;
    this.currentProgramId = programId;
    try {
      const data = await api.get<ProgramExercise[]>(`/programs/${programId}/exercises`);
      runInAction(() => { this.programExercises = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки упражнений программы';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoadingExercises = false; });
    }
  }

  async addExercise(programId: number, payload: ProgramExerciseCreate): Promise<boolean> {
    try {
      await api.post(`/programs/${programId}/exercises`, payload);
      await this.loadExercises(programId);
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка добавления упражнения';
      toastStore.add(message, 'error');
      return false;
    }
  }

  async update(programId: number, payload: Partial<ProgramCreate>): Promise<boolean> {
    try {
      await api.put(`/programs/${programId}`, payload);
      toastStore.add('Программа обновлена', 'success');
      await this.load();
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка обновления';
      toastStore.add(message, 'error');
      return false;
    }
  }

  async fetchCalendar(programId: number) {
    this.isLoadingCalendar = true;
    try {
      const data = await api.get<CalendarItem[]>(`/programs/${programId}/calendar`);
      runInAction(() => { this.calendar = data; });
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : 'Ошибка загрузки календаря';
      toastStore.add(message, 'error');
    } finally {
      runInAction(() => { this.isLoadingCalendar = false; });
    }
  }
}

export const programsStore = new ProgramsStore();
