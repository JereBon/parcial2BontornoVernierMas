import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let _nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((message: string, type: ToastType) => {
    const id = ++_nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const remove = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider
      value={{
        success: (msg) => add(msg, 'success'),
        error: (msg) => add(msg, 'error'),
        info: (msg) => add(msg, 'info'),
      }}
    >
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-[9999] pointer-events-none">
        {toasts.map((t) => (
          <ToastBubble key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const STYLES: Record<ToastType, { wrap: string; text: string; icon: ReactNode }> = {
  success: {
    wrap: 'bg-green-50 border-green-300',
    text: 'text-green-800',
    icon: <CheckCircle size={18} className="text-green-600 flex-shrink-0" />,
  },
  error: {
    wrap: 'bg-red-50 border-red-300',
    text: 'text-red-800',
    icon: <AlertCircle size={18} className="text-red-600 flex-shrink-0" />,
  },
  info: {
    wrap: 'bg-blue-50 border-blue-300',
    text: 'text-blue-800',
    icon: <Info size={18} className="text-blue-600 flex-shrink-0" />,
  },
};

function ToastBubble({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const s = STYLES[toast.type];
  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg max-w-sm w-full ${s.wrap}`}
    >
      {s.icon}
      <span className={`text-sm flex-1 ${s.text}`}>{toast.message}</span>
      <button onClick={onClose} className={`ml-1 hover:opacity-60 transition-opacity ${s.text}`}>
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}
