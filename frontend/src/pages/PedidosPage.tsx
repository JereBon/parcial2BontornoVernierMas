import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { pedidosApi } from '../api/pedidos';
import type { EstadoPedidoCodigo } from '../api/types';
import { SkeletonRows } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';
import { EstadoBadge } from '../components/EstadoBadge';

const LIMIT = 20;
const ESTADOS: EstadoPedidoCodigo[] = [
  'PENDIENTE', 'CONFIRMADO', 'EN_PREP', 'ENTREGADO', 'CANCELADO',
];

export default function PedidosPage() {
  const [params, setParams] = useSearchParams();
  const estadoParam = params.get('estado') as EstadoPedidoCodigo | null;
  const [offset, setOffset] = useState(0);

  const page = Math.floor(offset / LIMIT) + 1;
  const filters = { page, size: LIMIT, estado: estadoParam ?? undefined };

  const listQ = useQuery({
    queryKey: ['pedidos', 'all', filters],
    queryFn: () => pedidosApi.listAll(filters),
    refetchInterval: 5_000,
    placeholderData: (prev) => prev,
  });

  const setEstado = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('estado', value); else next.delete('estado');
    setParams(next, { replace: true });
    setOffset(0);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Pedidos</h1>

      <div className="card mb-4 flex flex-wrap gap-4 items-end">
        <div className="w-56">
          <label className="label">Estado</label>
          <select className="input" value={estadoParam ?? ''} onChange={(e) => setEstado(e.target.value)}>
            <option value="">— Todos —</option>
            {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {listQ.isError && (
        <ErrorBanner message={(listQ.error as Error).message} onRetry={() => listQ.refetch()} />
      )}

      <div className="card p-0 overflow-hidden">
        {listQ.isLoading ? (
          <div className="p-4"><SkeletonRows count={6} /></div>
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
              {listQ.data?.items.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="table-cell text-gray-500">#{p.id}</td>
                  <td className="table-cell"><EstadoBadge estado={p.estado.codigo} /></td>
                  <td className="table-cell text-xs">{p.forma_pago.descripcion}</td>
                  <td className="table-cell">usuario #{p.usuario_id}</td>
                  <td className="table-cell text-gray-600 truncate max-w-xs">
                    {p.direccion ? `${p.direccion.linea1}, ${p.direccion.ciudad}` : '—'}
                  </td>
                  <td className="table-cell font-semibold text-right">${p.total.toFixed(2)}</td>
                  <td className="table-cell text-gray-500 text-xs">
                    {new Date(p.created_at).toLocaleString()}
                  </td>
                  <td className="table-cell text-right">
                    <Link to={`/pedidos/${p.id}`} className="btn-ghost text-blue-600">Ver</Link>
                  </td>
                </tr>
              ))}
              {listQ.data?.items.length === 0 && (
                <tr><td colSpan={8} className="table-cell text-center text-gray-500 py-8">Sin pedidos.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {listQ.data && (
        <Pagination total={listQ.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
      )}
    </div>
  );
}
