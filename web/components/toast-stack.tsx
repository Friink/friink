"use client";

export type ToastMessage = {
  id: number;
  title?: string;
  message: string;
  code?: string;
  detail?: string;
  timestamp: string;
  tone?: 'error' | 'success';
};

export type ToastInput = string | Omit<ToastMessage, 'id' | 'timestamp'>;

type ToastStackProps = {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
};

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div className={`toast-message toast-${toast.tone ?? 'error'}`} key={toast.id} role="status">
          <div className="toast-copy">
            {toast.title && <strong className="toast-title">{toast.title}</strong>}
            {toast.code && <span className="toast-code">{toast.code}</span>}
            <p>{toast.message}</p>
            {toast.detail && <span className="toast-detail">{toast.detail}</span>}
            <time>{toast.timestamp}</time>
          </div>
          <button type="button" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
