import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePedidos } from '../context/PedidosContext';
import type { EstadoPedidoCodigo } from '../models/types';
import { SkeletonRows } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';
import { EstadoBadge } from '../components/EstadoBadge';
import { usePolling } from '../hooks/usePolling';
import { useFiltrosPedidos } from '../hooks/useFiltrosPedidos';

const LIMIT = 20;
const ESTADOS: EstadoPedidoCodigo[] = [
  'PENDIENTE',
  'CONFIRMADO',
  'EN_PREPARACION',
  'EN_CAMINO',
  'ENTREGADO',
  'CANCELADO',
];

export default function PedidosPage() {
  const [params, setParams] = useSearchParams();
  const estadoParam = params.get('estado') as EstadoPedidoCodigo | null;
  const { estado, setEstado } = useFiltrosPedidos();
  const [offset, setOffset] = useState(0);

  const { pedidos, total, cargando, error, cargar } = usePedidos();

  const recargar = useCallback(() => {
    cargar({ skip: offset, limit: LIMIT, estado: estadoParam ?? (estado || undefined) });
  }, [cargar, offset, estadoParam, estado]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  usePolling(recargar, 5_000);

  const cambiarEstado = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('estado', value);
    else next.delete('estado');
    setParams(next, { replace: true });
    setEstado(value as EstadoPedidoCodigo | '');
    setOffset(0);
  };

  const estadoActivo = estadoParam ?? estado;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Pedidos</h1>

      <div className="card mb-4 flex flex-wrap gap-4 items-end">
        <div className="w-56">
          <label className="label">Estado</label>
          <select
            className="input"
            value={estadoActivo ?? ''}
            onChange={(e) => cambiarEstado(e.target.value)}
          >
            <option value="">— Todos —</option>
            {ESTADOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={recargar} />}

      <div className="card p-0 overflow-hidden">
        {cargando ? (
          <div className="p-4">
            <SkeletonRows count={6} />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head w-16">#</th>
                <th className="table-head">Estado</th>
                <th className="table-head">Pago</th>
                <th className="table-head">Cliente</th>
                <th className="table-head">Direccion</th>
                <th className="table-head text-right">Total</th>
                <th className="table-head w-40">Fecha</th>
                <th className="table-head w-24"></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="table-cell text-gray-500">#{p.id}</td>
                  <td className="table-cell">
                    <EstadoBadge estado={p.estado.codigo} />
                  </td>
                  <td className="table-cell text-xs">{p.forma_pago.nombre}</td>
                  <td className="table-cell">usuario #{p.usuario_id}</td>
                  <td className="table-cell text-gray-600 truncate max-w-xs">
                    {p.direccion_snapshot}
                  </td>
                  <td className="table-cell font-semibold text-right">
                    ${p.total.toFixed(2)}
                  </td>
                  <td className="table-cell text-gray-500 text-xs">
                    {new Date(p.created_at).toLocaleString()}
                  </td>
                  <td className="table-cell text-right">
                    <Link to={`/pedidos/${p.id}`} className="btn-ghost text-blue-600">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
              {pedidos.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-cell text-center text-gray-500 py-8">
                    Sin pedidos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Pagination total={total} limit={LIMIT} offset={offset} onChange={setOffset} />
    </div>
  );
}
