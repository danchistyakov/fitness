import { observer } from 'mobx-react-lite';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { toastStore } from '../stores';

const icons = {
  error: AlertCircle,
  success: CheckCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  error: '#ff4757',
  success: '#00d4aa',
  warning: '#ffc107',
  info: '#5c7cfa',
};

const ToastContainer = observer(() => {
  if (toastStore.toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toastStore.toasts.map(toast => {
        const Icon = icons[toast.type] || icons.info;
        return (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <Icon size={20} color={colors[toast.type]} style={{ flexShrink: 0 }} />
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => toastStore.remove(toast.id)}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
});

export default ToastContainer;