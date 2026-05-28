interface ErrorBannerProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message = 'Ocurrio un error', onRetry }: ErrorBannerProps) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-800 rounded p-4 flex items-center justify-between">
      <span className="text-sm">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost text-red-700 hover:bg-red-100">
          Reintentar
        </button>
      )}
    </div>
  );
}
