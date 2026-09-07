"use client";

import { useEffect, useState } from 'react';

export type ToastMessage = {
  id: number;
  title?: string;
  message: string;
  code?: string;
  detail?: string;
  timestamp: string;
  tone?: 'error' | 'success';
  countdownUntil?: number;
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
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!toast.countdownUntil || toast.countdownUntil <= Date.now()) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= toast.countdownUntil!) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [toast.countdownUntil]);

  const remainingMinutes = toast.countdownUntil
    ? Math.max(0, Math.ceil((toast.countdownUntil - now) / 60000))
    : null;
  const message = remainingMinutes !== null
    ? remainingMinutes > 0
      ? `You can deactivate your account again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`
      : 'You can deactivate your account again now.'
    : toast.message;

  return (
    <div className={`toast-message toast-${toast.tone ?? 'error'}`} role="status">
      <div className="toast-copy">
        {toast.title && <strong className="toast-title">{toast.title}</strong>}
        {toast.code && <span className="toast-code">{toast.code}</span>}
        <p>{message}</p>
        {toast.detail && <span className="toast-detail">{toast.detail}</span>}
        <time>{toast.timestamp}</time>
      </div>
      <button type="button" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
        <i className="fa-solid fa-xmark" aria-hidden="true" />
      </button>
    </div>
  );
}
