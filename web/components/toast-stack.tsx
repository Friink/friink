"use client";

export type ToastMessage = {
  id: number;
  message: string;
  timestamp: string;
  tone?: 'error' | 'success';
};

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
            <p>{toast.message}</p>
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
