'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

interface Toast {
  id: number;
  message: string;
  kind: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  showToast: (message: string, kind?: Toast['kind']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 md:bottom-6"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`glass-strong pointer-events-auto max-w-[92vw] rounded-full px-4 py-2 text-sm shadow-lg ${
              t.kind === 'error' ? 'text-accent' : t.kind === 'info' ? 'text-paper/80' : 'text-paper'
            }`}
          >
            {t.kind === 'success' && '✓ '}
            {t.kind === 'error' && '⚠ '}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback silencieux si le provider n'est pas monté (ne devrait pas arriver)
    return { showToast: (_m: string) => {} };
  }
  return ctx;
}
