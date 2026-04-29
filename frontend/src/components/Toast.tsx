import { observer } from 'mobx-react-lite';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { toastStore } from '@/stores';
import type { Toast as ToastType } from '@/stores';
import s from './Toast.module.scss';

const ICONS = {
  error:   AlertCircle,
  success: CheckCircle,
  warning: AlertTriangle,
  info:    Info,
} as const;

const ToastContainer = observer(() => {
  if (toastStore.toasts.length === 0) return null;
  return (
    <div className={s.container} aria-live="polite" aria-atomic="true">
      {toastStore.toasts.map((toast: ToastType) => {
        const Icon = ICONS[toast.type] ?? Info;
        return (
          <div key={toast.id} className={`${s.toast} ${s[`toast-${toast.type}`]}`}>
            <Icon size={18} className={s.icon} />
            <span className={s.message}>{toast.message}</span>
            <button
              className={s.closeBtn}
              onClick={() => toastStore.remove(toast.id)}
              aria-label="Закрыть"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
});

export default ToastContainer;
