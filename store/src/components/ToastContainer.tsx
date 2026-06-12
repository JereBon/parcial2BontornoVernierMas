import { useEffect } from 'react';
import { useToastStore, type Toast } from '../stores/toastStore';

const BG: Record<Toast['type'], string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-blue-600',
};

const AUTO_CLOSE_MS = 4000;

function ToastItem({ toast }: { toast: Toast }) {
  const remove = useToastStore((s) => s.remove);

  useEffect(() => {
    const timer = setTimeout(() => remove(toast.id), AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [toast.id, remove]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded shadow-lg text-white text-sm max-w-sm ${BG[toast.type]}`}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => remove(toast.id)}
        className="opacity-70 hover:opacity-100 font-bold text-base leading-none"
        aria-label="Cerrar"
      >
        &times;
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
