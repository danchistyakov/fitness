import { makeAutoObservable } from 'mobx';

export interface Toast {
  id: number;
  message: string;
  type: 'error' | 'success' | 'warning' | 'info';
  duration: number;
}

class ToastStore {
  toasts: Toast[] = [];
  private nextId = 0;

  constructor() {
    makeAutoObservable(this);
  }

  add(message: string, type: Toast['type'] = 'error', duration = 5000): number {
    const id = ++this.nextId;
    this.toasts.push({ id, message, type, duration });

    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
    return id;
  }

  remove(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
}

export const toastStore = new ToastStore();
