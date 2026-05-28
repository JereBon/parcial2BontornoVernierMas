import { useState, useEffect, useCallback } from 'react';
import { pedidosApi } from '../api/pedidos';
import type { EstadoPedidoCodigo, Pedido } from '../models/types';
import { SkeletonRows } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { EstadoBadge } from '../components/EstadoBadge';
import { usePolling } from '../hooks/usePolling';

const NEXT: Partial<Record<EstadoPedidoCodigo, EstadoPedidoCodigo>> = {
  PENDIENTE: 'CONFIRMADO',
  CONFIRMADO: 'EN_PREPARACION',
  EN_PREPARACION: 'EN_CAMINO',
  EN_CAMINO: 'ENTREGADO',
};

const COLUMNS: Array<{ estado: EstadoPedidoCodigo; titulo: string }> = [
  { estado: 'PENDIENTE', titulo: 'Aprobar' },
  { estado: 'CONFIRMADO', titulo: 'Preparar' },
  { estado: 'EN_PREPARACION', titulo: 'Enviar' },
  { estado: 'EN_CAMINO', titulo: 'Entregar' },
];

export default function CajeroPage() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  const avanzar = async (id: number, nuevoEstado: EstadoPedidoCodigo) => {
    setErrorMsg(null);
    setProcesando(true);
    try {
      await pedidosApi.cambiarEstado(id, nuevoEstado);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Cajero</h1>
      <p className="text-gray-500 mb-6">Avanza los pedidos por su flujo natural.</p>

      {errorMsg && (
        <div className="mb-4">
          <ErrorBanner message={errorMsg} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <ColumnaEstado
            key={col.estado}
            estado={col.estado}
            tituloAccion={col.titulo}
            siguiente={NEXT[col.estado]!}
            isPending={procesando}
            onAdvance={avanzar}
          />
        ))}
      </div>
    </div>
  );
}

interface ColProps {
  estado: EstadoPedidoCodigo;
  tituloAccion: string;
  siguiente: EstadoPedidoCodigo;
  isPending: boolean;
  onAdvance: (id: number, nuevo: EstadoPedidoCodigo) => void;
}

function ColumnaEstado({ estado, tituloAccion, siguiente, isPending, onAdvance }: ColProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const data = await pedidosApi.listAll({ estado, limit: 50 });
      setPedidos(data.items);
    } catch {
      // columna individual, silenciar error
    } finally {
      setCargando(false);
    }
  }, [estado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  usePolling(cargar, 5_000);

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <p className="text-xs uppercase font-semibold text-gray-500">{estado}</p>
        <p className="text-sm font-semibold">{tituloAccion}</p>
      </div>
      <div className="p-3 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
        {cargando ? (
          <SkeletonRows count={3} className="h-16" />
        ) : pedidos.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Sin pedidos.</p>
        ) : (
          pedidos.map((p) => (
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
                onClick={() => { onAdvance(p.id, siguiente); cargar(); }}
              >
                → {siguiente}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
