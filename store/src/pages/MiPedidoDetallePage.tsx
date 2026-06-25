import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { pedidosApi } from '../api/pedidos';
import type { EstadoPedidoCodigo } from '../api/types';
import { Skeleton } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { EstadoBadge } from '../components/EstadoBadge';
import { useOrderStatusWS } from '../hooks/useOrderStatusWS';
import { useToastStore } from '../stores/toastStore';

const MP_STATUS_LABEL: Record<string, string> = {
  approved: 'Aprobado',
  pending: 'Pendiente',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  in_process: 'En proceso',
  in_mediation: 'En mediación',
  refunded: 'Devuelto',
  charged_back: 'Contracargo',
};

const MP_METHOD_LABEL: Record<string, string> = {
  credit_card: 'Tarjeta de crédito',
  debit_card: 'Tarjeta de débito',
  account_money: 'Dinero en cuenta MP',
  ticket: 'Ticket / Efectivo',
  bank_transfer: 'Transferencia bancaria',
};

const CANCELABLE: EstadoPedidoCodigo[] = ['PENDIENTE', 'CONFIRMADO'];

export default function MiPedidoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const mpStatus = searchParams.get('mp');
  const pedidoId = Number(id);
  const qc = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pushToast = useToastStore((s) => s.push);

  const pedidoQ = useQuery({
    queryKey: ['pedidos', pedidoId],
    queryFn: () => pedidosApi.get(pedidoId),
    enabled: !Number.isNaN(pedidoId),
    // WS invalidates queries on change, so reduce polling interval
    refetchInterval: 30_000,
  });

  const { connected, lastEvent } = useOrderStatusWS(
    Number.isNaN(pedidoId) ? undefined : pedidoId,
  );

  const isMercadoPago = pedidoQ.data?.forma_pago?.codigo === 'MERCADOPAGO';
  const pagoQ = useQuery({
    queryKey: ['pagos', pedidoId],
    queryFn: () => pedidosApi.getPago(pedidoId),
    enabled: !Number.isNaN(pedidoId) && isMercadoPago,
    retry: false,
  });

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.event === 'estado_cambiado') {
      pushToast(`Estado actualizado: ${lastEvent.estado_nuevo}`, 'info');
    } else if (lastEvent.event === 'pedido_cancelado') {
      pushToast(
        `Pedido cancelado${lastEvent.motivo ? `: ${lastEvent.motivo}` : ''}`,
        'error',
      );
    }
  }, [lastEvent, pushToast]);

  const cancelMut = useMutation({
    mutationFn: () => pedidosApi.cancelar(pedidoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos'] }),
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
  const canCancel = CANCELABLE.includes(estadoCodigo);

  return (
    <div>
      <Link to="/mis-pedidos" className="btn-ghost text-orange-600 mb-4 inline-block">
        &larr; Volver a mis pedidos
      </Link>

      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-bold">Pedido #{p.id}</h1>
        <EstadoBadge estado={estadoCodigo} />
      </div>

      {/* WebSocket connection status */}
      <div className="flex items-center gap-1.5 text-xs mb-4">
        <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className={connected ? 'text-green-700' : 'text-red-600'}>
          {connected ? 'Actualizaciones en tiempo real' : 'Sin conexion en tiempo real'}
        </span>
      </div>

      {mpStatus === 'approved' && estadoCodigo !== 'CANCELADO' && estadoCodigo !== 'ENTREGADO' && (
        <div className="mb-4 bg-green-50 border border-green-300 text-green-800 rounded-lg px-4 py-3 font-semibold">
          ✓ Pago confirmado — tu pedido está siendo procesado
        </div>
      )}
      {mpStatus === 'pending' && (
        <div className="mb-4 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg px-4 py-3 font-semibold">
          ⏳ Pago pendiente — te avisaremos cuando se acredite
        </div>
      )}
      {mpStatus === 'failure' && (
        <div className="mb-4 bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-3 font-semibold">
          ✗ El pago fue rechazado — intentá con otro medio de pago
        </div>
      )}
      {errorMsg && <div className="mb-4"><ErrorBanner message={errorMsg} /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h2 className="font-semibold mb-3">Datos</h2>
          <p className="text-sm text-gray-500">Direccion</p>
          <p className="mb-2">
            {p.direccion
              ? `${p.direccion.linea1}${p.direccion.linea2 ? `, ${p.direccion.linea2}` : ''}, ${p.direccion.ciudad}`
              : '—'}
          </p>
          <p className="text-sm text-gray-500">Forma de pago</p>
          <p className="mb-2">{p.forma_pago.descripcion}</p>

          {isMercadoPago && pagoQ.data && (
            <div className="mb-3 mt-1 bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col gap-1 text-sm">
              <p className="font-semibold text-blue-800 mb-1">Datos del pago — MercadoPago</p>
              {pagoQ.data.mp_payment_id && (
                <div className="flex justify-between">
                  <span className="text-gray-500">ID de pago</span>
                  <span className="font-mono text-xs">{pagoQ.data.mp_payment_id}</span>
                </div>
              )}
              {pagoQ.data.mp_preference_id && (
                <div className="flex justify-between">
                  <span className="text-gray-500">ID de preferencia</span>
                  <span className="font-mono text-xs truncate max-w-[180px]">{pagoQ.data.mp_preference_id}</span>
                </div>
              )}
              {pagoQ.data.mp_status && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Estado</span>
                  <span className={`font-semibold ${pagoQ.data.mp_status === 'approved' ? 'text-green-700' : pagoQ.data.mp_status === 'rejected' ? 'text-red-700' : 'text-yellow-700'}`}>
                    {MP_STATUS_LABEL[pagoQ.data.mp_status] ?? pagoQ.data.mp_status}
                  </span>
                </div>
              )}
              {pagoQ.data.mp_status_detail && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Detalle</span>
                  <span className="text-gray-700">{pagoQ.data.mp_status_detail}</span>
                </div>
              )}
              {pagoQ.data.payment_method_id && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Método</span>
                  <span>{MP_METHOD_LABEL[pagoQ.data.payment_method_id] ?? pagoQ.data.payment_method_id}</span>
                </div>
              )}
              {pagoQ.data.transaction_amount != null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Monto procesado</span>
                  <span className="font-semibold">${Number(pagoQ.data.transaction_amount).toFixed(2)}</span>
                </div>
              )}
              {pagoQ.data.external_reference && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Referencia externa</span>
                  <span className="font-mono text-xs">{pagoQ.data.external_reference}</span>
                </div>
              )}
            </div>
          )}

          {p.notas && (<><p className="text-sm text-gray-500">Notas</p><p className="mb-2">{p.notas}</p></>)}
          <p className="text-sm text-gray-500 mt-2">Subtotal</p>
          <p className="mb-1">${p.subtotal.toFixed(2)}</p>
          {p.descuento > 0 && (
            <>
              <p className="text-sm text-gray-500">Descuento</p>
              <p className="mb-1 text-green-700">-${p.descuento.toFixed(2)}</p>
            </>
          )}
          <p className="text-sm text-gray-500">Envio</p>
          <p className="mb-2">${p.costo_envio.toFixed(2)}</p>
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-orange-600">${p.total.toFixed(2)}</p>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3">Fechas</h2>
          <p className="text-sm text-gray-500">Creado</p>
          <p className="mb-2">{new Date(p.created_at).toLocaleString()}</p>
          <p className="text-sm text-gray-500">Actualizado</p>
          <p className="mb-4">{new Date(p.updated_at).toLocaleString()}</p>

          {canCancel && (
            <button className="btn-danger w-full" disabled={cancelMut.isPending}
              onClick={() => {
                if (confirm('Cancelar este pedido?')) { setErrorMsg(null); cancelMut.mutate(); }
              }}>
              Cancelar pedido
            </button>
          )}
          {!canCancel && estadoCodigo !== 'CANCELADO' && estadoCodigo !== 'ENTREGADO' && (
            <p className="text-xs text-gray-500">
              Ya no se puede cancelar (estado actual: {estadoCodigo}).
            </p>
          )}
        </div>
      </div>

      <div className="card mt-6 p-0 overflow-hidden">
        <h2 className="font-semibold p-4 border-b">Items</h2>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Producto</th>
              <th className="text-right text-xs font-semibold text-gray-600 uppercase px-4 py-3">Precio</th>
              <th className="text-right text-xs font-semibold text-gray-600 uppercase px-4 py-3">Cantidad</th>
              <th className="text-right text-xs font-semibold text-gray-600 uppercase px-4 py-3">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {p.detalles.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-3 font-medium">{d.nombre_snapshot}</td>
                <td className="px-4 py-3 text-right">${d.precio_snapshot.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{d.cantidad}</td>
                <td className="px-4 py-3 text-right font-semibold">${d.subtotal_snap.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-gray-50">
              <td colSpan={3} className="px-4 py-3 text-right font-semibold">Subtotal</td>
              <td className="px-4 py-3 text-right font-bold">${p.subtotal.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold mb-3">Historial</h2>
        <ul className="flex flex-col gap-2">
          {p.historial.map((h) => (
            <li key={h.id} className="flex items-center gap-3 text-sm">
              <span className="text-gray-500 w-44">{new Date(h.created_at).toLocaleString()}</span>
              <span className="flex items-center gap-1 flex-wrap">
                {h.estado_desde && (
                  <><EstadoBadge estado={h.estado_desde.codigo} /><span className="text-gray-400">→</span></>
                )}
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
