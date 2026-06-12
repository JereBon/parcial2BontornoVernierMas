import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { pedidosApi } from '../api/pedidos';
import type { EstadoPedidoCodigo } from '../api/types';
import { SkeletonRows } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';
import { EstadoBadge } from '../components/EstadoBadge';

const LIMIT = 10;
const ESTADOS: EstadoPedidoCodigo[] = [
  'PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'ENTREGADO', 'CANCELADO',
];

export default function MisPedidosPage() {
  const [offset, setOffset] = useState(0);
  const [estado, setEstado] = useState<EstadoPedidoCodigo | ''>('');

  const filters = {
    skip: offset, limit: LIMIT,
    estado: estado === '' ? undefined : estado,
  };

  const listQ = useQuery({
    queryKey: ['pedidos', 'mine', filters],
    queryFn: () => pedidosApi.listMine(filters),
    refetchInterval: 5_000,
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Mis pedidos</h1>

      <div className="card mb-4 flex flex-wrap gap-4 items-end">
        <div className="w-56">
          <label className="label">Filtrar por estado</label>
          <select className="input" value={estado}
            onChange={(e) => { setEstado(e.target.value as EstadoPedidoCodigo | ''); setOffset(0); }}>
            <option value="">— Todos —</option>
            {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {listQ.isError && (
        <ErrorBanner message={(listQ.error as Error).message} onRetry={() => listQ.refetch()} />
      )}

      {listQ.isLoading ? (
        <SkeletonRows count={5} className="h-16" />
      ) : listQ.data?.items.length === 0 ? (
        <div className="card text-center text-gray-500">
          Todavia no hiciste pedidos.{' '}
          <Link to="/" className="text-orange-600 hover:underline">Ir al catalogo</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {listQ.data?.items.map((p) => (
            <Link to={`/mis-pedidos/${p.id}`} key={p.id}
              className="card-hover flex items-center justify-between">
              <div>
                <p className="font-semibold">Pedido #{p.id}</p>
                <p className="text-xs text-gray-500">{new Date(p.created_at).toLocaleString()}</p>
                {p.direccion && (
                  <p className="text-sm text-gray-600 mt-1">
                    {p.direccion.linea1}{p.direccion.linea2 ? `, ${p.direccion.linea2}` : ''}, {p.direccion.ciudad}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">Pago: {p.forma_pago.descripcion}</p>
              </div>
              <div className="text-right">
                <EstadoBadge estado={p.estado.codigo} />
                <p className="text-xl font-bold text-orange-600 mt-2">${p.total.toFixed(2)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {listQ.data && (
        <Pagination total={listQ.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
      )}
    </div>
  );
}
