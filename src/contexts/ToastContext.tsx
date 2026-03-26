import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  text: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (text: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((text: string, type: ToastType = 'info', duration = 4500) => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast: addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-[340px]">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-start gap-2 px-4 py-3 rounded-xl text-sm shadow-lg animate-in slide-in-from-right duration-200 ${
              t.type === 'success' ? 'bg-[#052e16] text-[#4ade80] border border-[#14532d]' :
              t.type === 'error' ? 'bg-[#450a0a] text-[#f87171] border border-[#7f1d1d]' :
              'bg-[#0c1a4d] text-[#93c5fd] border border-[#1e3a8a]'
            }`}
          >
            <span className="flex-1">{t.text}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-current"
            >
              &#x2715;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
