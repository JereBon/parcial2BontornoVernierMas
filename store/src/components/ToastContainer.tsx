import { useEffect, useState } from 'react';
import { useToastStore, type Toast } from '../stores/toastStore';

const AUTO_CLOSE_MS = 4000;

const STYLES: Record<Toast['type'], { bg: string; icon: string }> = {
  success: { bg: 'bg-green-500', icon: '✓' },
  error:   { bg: 'bg-red-500',   icon: '✕' },
  info:    { bg: 'bg-blue-500',  icon: 'ℹ' },
};

function ToastItem({ toast }: { toast: Toast }) {
  const remove = useToastStore((s) => s.remove);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // entrada: frame siguiente para triggear la transición CSS
    const enter = requestAnimationFrame(() => setVisible(true));
    // salida: empieza a desaparecer 600ms antes de que se elimine
    const exit = setTimeout(() => setVisible(false), AUTO_CLOSE_MS - 600);
    const destroy = setTimeout(() => remove(toast.id), AUTO_CLOSE_MS);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(exit);
      clearTimeout(destroy);
    };
  }, [toast.id, remove]);

  const { bg, icon } = STYLES[toast.type];

  return (
    <div
      style={{ transition: 'opacity 350ms ease, transform 350ms ease' }}
      className={`
        flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl text-white
        text-base font-medium min-w-[280px] max-w-sm cursor-pointer
        ${bg}
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
      `}
      onClick={() => remove(toast.id)}
    >
      <span className="text-xl font-bold leading-none">{icon}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        className="opacity-60 hover:opacity-100 text-lg font-bold leading-none ml-1"
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
    <div className="fixed top-20 right-5 flex flex-col gap-3 z-50">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
