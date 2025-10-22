'use client';

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cn } from './utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType, duration?: number) => string;
  dismissToast: (id: string) => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const toneStyles: Record<ToastType, string> = {
  success:
    'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-[0_8px_16px_-12px_rgba(16,185,129,0.5)] dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100',
  error:
    'border-rose-300 bg-rose-50 text-rose-900 shadow-[0_8px_16px_-12px_rgba(244,63,94,0.5)] dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100',
  info:
    'border-indigo-300 bg-indigo-50 text-indigo-900 shadow-[0_8px_16px_-12px_rgba(99,102,241,0.4)] dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-100',
  warning:
    'border-amber-300 bg-amber-50 text-amber-900 shadow-[0_8px_16px_-12px_rgba(251,191,36,0.45)] dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timeoutsRef = useRef<Record<string, number>>({});

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timeoutId = timeoutsRef.current[id];
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete timeoutsRef.current[id];
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 5000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const toast: ToastMessage = { id, type, message, duration };

      setToasts((prev) => [...prev, toast]);

      if (duration > 0) {
        const timeoutId = window.setTimeout(() => {
          dismissToast(id);
        }, duration);
        timeoutsRef.current[id] = timeoutId;
      }

      return id;
    },
    [dismissToast],
  );

  const success = useCallback(
    (message: string, duration?: number) => showToast(message, 'success', duration ?? 5000),
    [showToast],
  );
  const error = useCallback(
    (message: string, duration?: number) => showToast(message, 'error', duration ?? 5000),
    [showToast],
  );
  const info = useCallback(
    (message: string, duration?: number) => showToast(message, 'info', duration ?? 4000),
    [showToast],
  );
  const warning = useCallback(
    (message: string, duration?: number) => showToast(message, 'warning', duration ?? 5000),
    [showToast],
  );

  useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutsRef.current = {};
    };
  }, []);

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast, success, error, info, warning }),
    [dismissToast, error, info, showToast, success, toasts, warning],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-x-0 top-6 z-50 flex flex-col items-center gap-3 px-4 sm:items-end sm:pr-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-md backdrop-blur-sm',
              toneStyles[toast.type],
            )}
            role="status"
          >
            <div className="text-sm font-medium leading-5">{toast.message}</div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="ml-auto -mr-1 rounded-full p-1 text-sm text-current transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
