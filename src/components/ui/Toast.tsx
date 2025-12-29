'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  txHash?: string;
  duration?: number; // Duration in milliseconds, 0 means no auto-dismiss
  position?: 'left' | 'right'; // Toast position
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
    const duration = toast.duration !== undefined ? toast.duration : 2000; // Default 2 seconds
    setToasts((prev) => [...prev, { ...toast, id, duration }]);
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

  // Group toasts by position
  const leftToasts = toasts.filter(t => t.position === 'left');
  const rightToasts = toasts.filter(t => !t.position || t.position === 'right');

  return (
    <>
      {/* Left toasts */}
      {leftToasts.length > 0 && (
        <div className="fixed bottom-4 left-2 sm:left-4 z-[100] flex flex-col gap-3 max-w-[calc(100vw-1rem)] sm:max-w-md w-full pr-2 sm:pr-0">
          {leftToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
          ))}
        </div>
      )}
      
      {/* Right toasts */}
      {rightToasts.length > 0 && (
        <div className="fixed bottom-4 right-2 sm:right-4 z-[100] flex flex-col gap-3 max-w-[calc(100vw-1rem)] sm:max-w-md w-full pl-2 sm:pl-0">
          {rightToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  // Auto-dismiss after duration (if not 0)
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      className={`
        border-2 border-text shadow-[4px_4px_0_theme(colors.text)] animate-slide-in
        ${toast.type === 'success' ? 'bg-green-600' : ''}
        ${toast.type === 'error' ? 'bg-secondary' : ''}
        ${toast.type === 'info' ? 'bg-primary' : ''}
      `}
    >
      <div className="flex items-start gap-3 p-4">
        <span className="material-symbols-outlined text-text text-xl flex-shrink-0 mt-0.5">
          {toast.type === 'success' && 'check_circle'}
          {toast.type === 'error' && 'error'}
          {toast.type === 'info' && 'info'}
        </span>
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-text font-mono font-bold text-sm break-words">{toast.title}</p>
          {toast.message && (
            <p className="text-text/80 font-mono text-xs mt-1 break-words max-h-32 overflow-y-auto">
              {toast.message}
            </p>
          )}
          {toast.txHash && (
            <a
              href={`https://explorer.movementnetwork.xyz/txn/${toast.txHash}?network=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text font-mono text-xs mt-2 hover:underline flex items-center gap-1 block"
            >
              View transaction
              <span className="material-symbols-outlined text-xs">open_in_new</span>
            </a>
          )}
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-text hover:text-text/60 transition-colors flex-shrink-0 -mt-1 -mr-1 p-1"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    </div>
  );
}

