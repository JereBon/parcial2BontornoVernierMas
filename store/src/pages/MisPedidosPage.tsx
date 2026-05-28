import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { pedidosApi } from '../api/pedidos';
import type { EstadoPedidoCodigo, Paginated, Pedido } from '../models/types';
import { SkeletonRows } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';
import { EstadoBadge } from '../components/EstadoBadge';
import { usePolling } from '../hooks/usePolling';

const LIMIT = 10;
const ESTADOS: EstadoPedidoCodigo[] = [
  'PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO',
];

export default function MisPedidosPage() {
  const [offset, setOffset] = useState(0);
  const [estado, setEstado] = useState<EstadoPedidoCodigo | ''>('');
  const [data, setData] = useState<Paginated<Pedido> | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const result = await pedidosApi.listMine({
        skip: offset,
        limit: LIMIT,
        estado: estado === '' ? undefined : estado,
      });
      setData(result);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, [offset, estado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  usePolling(cargar, 5_000);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Mis pedidos</h1>

      <div className="card mb-4 flex flex-wrap gap-4 items-end">
        <div className="w-56">
          <label className="label">Filtrar por estado</label>
          <select
            className="input"
            value={estado}
            onChange={(e) => { setEstado(e.target.value as EstadoPedidoCodigo | ''); setOffset(0); }}
          >
            <option value="">— Todos —</option>
            {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={cargar} />}

      {cargando ? (
        <SkeletonRows count={5} className="h-16" />
      ) : data?.items.length === 0 ? (
        <div className="card text-center text-gray-500">
          Todavia no hiciste pedidos.{' '}
          <Link to="/" className="text-orange-600 hover:underline">Ir al catalogo</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data?.items.map((p) => (
            <Link
              to={`/mis-pedidos/${p.id}`}
              key={p.id}
              className="card-hover flex items-center justify-between"
            >
              <div>
                <p className="font-semibold">Pedido #{p.id}</p>
                <p className="text-xs text-gray-500">{new Date(p.created_at).toLocaleString()}</p>
                <p className="text-sm text-gray-600 mt-1">{p.direccion_snapshot}</p>
                <p className="text-xs text-gray-500 mt-1">Pago: {p.forma_pago.nombre}</p>
              </div>
              <div className="text-right">
                <EstadoBadge estado={p.estado.codigo} />
                <p className="text-xl font-bold text-orange-600 mt-2">${p.total.toFixed(2)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination total={data?.total ?? 0} limit={LIMIT} offset={offset} onChange={setOffset} />
    </div>
  );
}
