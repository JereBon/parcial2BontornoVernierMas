interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}

export function Pagination({ total, limit, offset, onChange }: PaginationProps) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-gray-600">
        {total === 0 ? '0 resultados' : `Pagina ${page} de ${totalPages} — ${total} resultados`}
      </span>
      <div className="flex gap-2">
        <button
          className="btn-secondary"
          onClick={() => onChange(Math.max(0, offset - limit))}
          disabled={!canPrev}
        >
          Anterior
        </button>
        <button
          className="btn-secondary"
          onClick={() => onChange(offset + limit)}
          disabled={!canNext}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
