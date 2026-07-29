'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { Check, XCircle } from 'lucide-react';
import clsx from 'clsx';

type Toast = { id: number; type: 'success' | 'error'; message: string };
type SuccessModal = { id: number; message: string };
type ToastContextValue = {
  success(message: string): void;
  error(message: string): void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [successModal, setSuccessModal] = useState<SuccessModal | null>(null);
  const value = useMemo(
    () => ({
      success: (message: string) => showSuccessModal(message),
      error: (message: string) => pushToast('error', message),
    }),
    [],
  );

  function showSuccessModal(message: string) {
    const id = Date.now();
    setSuccessModal({ id, message });
    window.setTimeout(() => {
      setSuccessModal((current) => (current?.id === id ? null : current));
    }, 2800);
  }

  function pushToast(type: Toast['type'], message: string) {
    const id = Date.now();
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {successModal && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/35 px-4 backdrop-blur-sm">
          <div
            role="status"
            aria-live="polite"
            className="success-modal-enter grid w-full max-w-sm justify-items-center rounded-lg border border-brand/20 bg-white px-6 py-7 text-center shadow-2xl"
          >
            <div className="success-check-ring grid h-20 w-20 place-items-center rounded-full bg-teal-50 text-brand">
              <Check className="success-check-icon h-11 w-11" strokeWidth={3} />
            </div>
            <h2 className="mt-5 text-xl font-bold text-ink">Success</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{successModal.message}</p>
            <button
              type="button"
              onClick={() => setSuccessModal(null)}
              className="focus-ring mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              OK
            </button>
          </div>
        </div>
      )}
      <div className="fixed inset-x-3 top-3 z-50 grid gap-2 sm:inset-x-auto sm:right-4 sm:top-4">
        {toasts.map((toast) => {
          return (
            <div
              key={toast.id}
              className={clsx(
                'flex w-full items-start gap-3 rounded-lg border bg-white px-4 py-3 text-sm shadow-soft sm:min-w-72 sm:max-w-sm',
                toast.type === 'success' ? 'border-brand/30 text-brand' : 'border-red-300 text-red-700',
              )}
            >
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-ink">{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
