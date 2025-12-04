'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  txHash?: string;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            p-4 border-2 border-text shadow-[4px_4px_0_theme(colors.text)] animate-slide-in
            ${toast.type === 'success' ? 'bg-green-600' : ''}
            ${toast.type === 'error' ? 'bg-secondary' : ''}
            ${toast.type === 'info' ? 'bg-primary' : ''}
          `}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-text text-xl flex-shrink-0">
                {toast.type === 'success' && 'check_circle'}
                {toast.type === 'error' && 'error'}
                {toast.type === 'info' && 'info'}
              </span>
              <div>
                <p className="text-text font-mono font-bold text-sm">{toast.title}</p>
                {toast.message && (
                  <p className="text-text/80 font-mono text-xs mt-1">{toast.message}</p>
                )}
                {toast.txHash && (
                  <a
                    href={`https://explorer.movementnetwork.xyz/txn/${toast.txHash}?network=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text font-mono text-xs mt-2 hover:underline flex items-center gap-1"
                  >
                    View transaction
                    <span className="material-symbols-outlined text-xs">open_in_new</span>
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-text hover:text-text/60 transition-colors flex-shrink-0"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

