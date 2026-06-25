import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pedidosApi } from '../api/pedidos';
import type { EstadoPedidoCodigo, Pedido } from '../api/types';
import { SkeletonRows } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { EstadoBadge } from '../components/EstadoBadge';

const NEXT: Partial<Record<EstadoPedidoCodigo, EstadoPedidoCodigo>> = {
  PENDIENTE: 'CONFIRMADO',
  CONFIRMADO: 'EN_PREP',
  EN_PREP: 'ENTREGADO',
};

const COLUMNS: EstadoPedidoCodigo[] = ['PENDIENTE', 'CONFIRMADO', 'EN_PREP'];

const LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREP: 'En preparación',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export default function CajeroPage() {
  const qc = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cambiarMut = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: EstadoPedidoCodigo }) =>
      pedidosApi.cambiarEstado(id, estado),
    onMutate: ({ id, estado: nuevoEstado }) => {
      // Buscar el pedido en cualquier columna
      let pedidoToMove: Pedido | undefined;
      let sourceCol: EstadoPedidoCodigo | undefined;
      for (const col of COLUMNS) {
        const data = qc.getQueryData<{ items: Pedido[]; total: number }>(['pedidos', 'cajero', col]);
        const found = data?.items.find((p) => p.id === id);
        if (found) { pedidoToMove = found; sourceCol = col; break; }
      }

      if (pedidoToMove && sourceCol) {
        // Sacar de columna origen
        qc.setQueryData<{ items: Pedido[]; total: number }>(
          ['pedidos', 'cajero', sourceCol],
          (old) => old ? { ...old, items: old.items.filter((p) => p.id !== id) } : old,
        );
        // Agregar en columna destino (solo si es una columna visible — no ENTREGADO)
        if ((COLUMNS as string[]).includes(nuevoEstado)) {
          const moved: Pedido = { ...pedidoToMove, estado: { ...pedidoToMove.estado, codigo: nuevoEstado } };
          qc.setQueryData<{ items: Pedido[]; total: number }>(
            ['pedidos', 'cajero', nuevoEstado],
            (old) => old ? { ...old, items: [moved, ...old.items] } : old,
          );
        }
      }

      return { pedidoToMove, sourceCol };
    },
    onError: (err, _vars, ctx) => {
      setErrorMsg((err as Error).message);
      // Revertir el move optimista
      if (ctx?.pedidoToMove && ctx.sourceCol) {
        qc.setQueryData<{ items: Pedido[]; total: number }>(
          ['pedidos', 'cajero', ctx.sourceCol],
          (old) => old ? { ...old, items: [ctx.pedidoToMove!, ...old.items] } : old,
        );
      }
      qc.invalidateQueries({ queryKey: ['pedidos', 'cajero'] });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['pedidos', 'cajero'] }),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Cajero</h1>
      <p className="text-gray-500 mb-6">Avanza los pedidos por su flujo natural.</p>

      {errorMsg && <div className="mb-4"><ErrorBanner message={errorMsg} /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {COLUMNS.map((estado) => (
          <ColumnaEstado
            key={estado}
            estado={estado}
            label={LABEL[estado]}
            siguiente={NEXT[estado]!}
            isPending={cambiarMut.isPending}
            onAdvance={(id, sig) => { setErrorMsg(null); cambiarMut.mutate({ id, estado: sig }); }}
          />
        ))}
      </div>
    </div>
  );
}

interface ColProps {
  estado: EstadoPedidoCodigo;
  label: string;
  siguiente: EstadoPedidoCodigo;
  isPending: boolean;
  onAdvance: (id: number, nuevo: EstadoPedidoCodigo) => void;
}

function ColumnaEstado({ estado, label, siguiente, isPending, onAdvance }: ColProps) {
  const q = useQuery({
    queryKey: ['pedidos', 'cajero', estado],
    queryFn: () => pedidosApi.listAll({ estado, size: 50 }),
    refetchInterval: 8_000,
  });

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <div className="p-3 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
        {q.isLoading ? <SkeletonRows count={3} className="h-16" />
         : q.data?.items.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Sin pedidos.</p>
         ) : (
          q.data?.items.map((p: Pedido) => (
            <div key={p.id} className="border rounded p-3 text-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">#{p.id}</span>
                <EstadoBadge estado={p.estado.codigo} />
              </div>
              <p className="text-xs text-gray-500">Usuario #{p.usuario_id}</p>
              <p className="font-bold text-blue-600 my-1">${p.total.toFixed(2)}</p>
              <button
                className="btn-primary w-full text-xs"
                disabled={isPending}
                onClick={() => onAdvance(p.id, siguiente)}
              >
                → {LABEL[siguiente] ?? siguiente}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
