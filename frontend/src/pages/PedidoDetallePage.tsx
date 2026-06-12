import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { pedidosApi } from '../api/pedidos';
import type { EstadoPedidoCodigo } from '../api/types';
import { Skeleton } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { EstadoBadge } from '../components/EstadoBadge';

const NEXT_STATE: Partial<Record<EstadoPedidoCodigo, EstadoPedidoCodigo>> = {
  PENDIENTE: 'CONFIRMADO',
  CONFIRMADO: 'EN_PREP',
  EN_PREP: 'ENTREGADO',
};

const TERMINAL: EstadoPedidoCodigo[] = ['ENTREGADO', 'CANCELADO'];

function formatDireccion(dir: { linea1: string; linea2?: string | null; ciudad: string; provincia?: string | null } | null | undefined): string {
  if (!dir) return '—';
  const parts = [dir.linea1, dir.linea2, dir.ciudad, dir.provincia].filter(Boolean);
  return parts.join(', ');
}

export default function PedidoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);
  const qc = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [motivo, setMotivo] = useState('');

  const pedidoQ = useQuery({
    queryKey: ['pedidos', pedidoId],
    queryFn: () => pedidosApi.get(pedidoId),
    enabled: !Number.isNaN(pedidoId),
    refetchInterval: 5_000,
  });

  const cambiarMut = useMutation({
    mutationFn: ({ estado, mot }: { estado: EstadoPedidoCodigo; mot?: string }) =>
      pedidosApi.cambiarEstado(pedidoId, estado, mot),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] });
      setShowCancelForm(false);
      setMotivo('');
    },
    onError: (err) => setErrorMsg((err as Error).message),
  });

  if (pedidoQ.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (pedidoQ.isError || !pedidoQ.data) {
    return <ErrorBanner message={(pedidoQ.error as Error)?.message ?? 'Pedido no encontrado'} />;
  }

  const p = pedidoQ.data;
  const estadoCodigo = p.estado.codigo;
  const next = NEXT_STATE[estadoCodigo];
  const isTerminal = TERMINAL.includes(estadoCodigo);

  return (
    <div>
      <Link to="/pedidos" className="btn-ghost text-blue-600 mb-4 inline-block">&larr; Volver</Link>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Pedido #{p.id}</h1>
        <EstadoBadge estado={estadoCodigo} />
      </div>

      {errorMsg && <div className="mb-4"><ErrorBanner message={errorMsg} /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-3">Datos</h2>
          <p className="text-sm text-gray-500">Cliente</p>
          <p className="mb-2">usuario #{p.usuario_id}</p>
          <p className="text-sm text-gray-500">Dirección de entrega</p>
          <p className="mb-2">{formatDireccion(p.direccion)}</p>
          <p className="text-sm text-gray-500">Forma de pago</p>
          <p className="mb-2">{p.forma_pago.descripcion}</p>
          {p.notas && (<><p className="text-sm text-gray-500">Notas</p><p className="mb-2">{p.notas}</p></>)}
          <hr className="my-3" />
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Subtotal</span>
            <span>${p.subtotal.toFixed(2)}</span>
          </div>
          {p.descuento > 0 && (
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Descuento</span>
              <span className="text-green-600">-${p.descuento.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm mb-3">
            <span className="text-gray-500">Costo de envío</span>
            <span>${p.costo_envio.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-2xl font-bold text-blue-600">${p.total.toFixed(2)}</span>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3">Acciones</h2>
          {isTerminal ? (
            <p className="text-gray-500 text-sm">Estado terminal — no admite cambios.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {next && (
                <button className="btn-primary" disabled={cambiarMut.isPending}
                  onClick={() => { setErrorMsg(null); cambiarMut.mutate({ estado: next }); }}>
                  Avanzar a {next}
                </button>
              )}
              {!showCancelForm ? (
                <button className="btn-danger" onClick={() => setShowCancelForm(true)}>
                  Cancelar pedido
                </button>
              ) : (
                <div className="border border-red-200 rounded-lg p-3 bg-red-50 flex flex-col gap-2">
                  <label className="text-sm font-medium text-red-800">
                    Motivo de cancelación <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    className="input text-sm"
                    rows={3}
                    placeholder="Ingresá el motivo..."
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn-danger flex-1 text-sm"
                      disabled={!motivo.trim() || cambiarMut.isPending}
                      onClick={() => {
                        setErrorMsg(null);
                        cambiarMut.mutate({ estado: 'CANCELADO', mot: motivo.trim() });
                      }}
                    >
                      Confirmar cancelación
                    </button>
                    <button
                      className="btn-ghost text-sm"
                      onClick={() => { setShowCancelForm(false); setMotivo(''); }}
                    >
                      No, volver
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3">Fechas</h2>
          <p className="text-sm text-gray-500">Creado</p>
          <p className="mb-2">{new Date(p.created_at).toLocaleString()}</p>
          <p className="text-sm text-gray-500">Actualizado</p>
          <p>{new Date(p.updated_at).toLocaleString()}</p>
        </div>
      </div>

      <div className="card mt-6 p-0 overflow-hidden">
        <h2 className="font-semibold p-4 border-b">Items (snapshot)</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-head">Producto</th>
              <th className="table-head text-right">Precio unit.</th>
              <th className="table-head text-right">Cantidad</th>
              <th className="table-head text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {p.detalles.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="table-cell font-medium">{d.nombre_snapshot}</td>
                <td className="table-cell text-right">${d.precio_snapshot.toFixed(2)}</td>
                <td className="table-cell text-right">{d.cantidad}</td>
                <td className="table-cell text-right font-semibold">${d.subtotal_snap.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-gray-50">
              <td colSpan={3} className="table-cell text-right font-semibold">Total</td>
              <td className="table-cell text-right font-bold">${p.total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold mb-3">Historial de estados</h2>
        <ul className="flex flex-col gap-2">
          {p.historial.map((h) => (
            <li key={h.id} className="flex items-start gap-3 text-sm">
              <span className="text-gray-500 w-44 shrink-0">{new Date(h.created_at).toLocaleString()}</span>
              <span className="flex items-center gap-1">
                {h.estado_desde ? (
                  <><EstadoBadge estado={h.estado_desde.codigo} /><span className="text-gray-400">→</span></>
                ) : null}
                {h.estado_hacia && <EstadoBadge estado={h.estado_hacia.codigo} />}
              </span>
              {h.motivo && <span className="text-gray-500">— {h.motivo}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
