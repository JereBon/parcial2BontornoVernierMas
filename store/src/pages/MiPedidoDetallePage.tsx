import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { pedidosApi } from '../api/pedidos';
import type { EstadoPedidoCodigo, PedidoFull } from '../models/types';
import { Skeleton } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { EstadoBadge } from '../components/EstadoBadge';
import { usePolling } from '../hooks/usePolling';

const CANCELABLE: EstadoPedidoCodigo[] = ['PENDIENTE', 'CONFIRMADO'];

export default function MiPedidoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);

  const [pedido, setPedido] = useState<PedidoFull | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    if (Number.isNaN(pedidoId)) return;
    try {
      const data = await pedidosApi.get(pedidoId);
      setPedido(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message ?? 'Pedido no encontrado');
    } finally {
      setCargando(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  usePolling(cargar, 5_000);

  const handleCancelar = async () => {
    if (!confirm('Cancelar este pedido?')) return;
    setErrorAccion(null);
    setProcesando(true);
    try {
      const actualizado = await pedidosApi.cancelar(pedidoId);
      setPedido(actualizado);
    } catch (err) {
      setErrorAccion((err as Error).message);
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !pedido) {
    return <ErrorBanner message={error ?? 'Pedido no encontrado'} />;
  }

  const p = pedido;
  const estadoCodigo = p.estado.codigo;
  const canCancel = CANCELABLE.includes(estadoCodigo);

  return (
    <div>
      <Link to="/mis-pedidos" className="btn-ghost text-orange-600 mb-4 inline-block">
        &larr; Volver a mis pedidos
      </Link>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Pedido #{p.id}</h1>
        <EstadoBadge estado={estadoCodigo} />
      </div>

      {errorAccion && <div className="mb-4"><ErrorBanner message={errorAccion} /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h2 className="font-semibold mb-3">Datos</h2>
          <p className="text-sm text-gray-500">Direccion (snapshot)</p>
          <p className="mb-2">{p.direccion_snapshot}</p>
          <p className="text-sm text-gray-500">Forma de pago</p>
          <p className="mb-2">{p.forma_pago.nombre}</p>
          {p.notas && (
            <>
              <p className="text-sm text-gray-500">Notas</p>
              <p className="mb-2">{p.notas}</p>
            </>
          )}
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
            <button
              className="btn-danger w-full"
              disabled={procesando}
              onClick={handleCancelar}
            >
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
                <td className="px-4 py-3 font-medium">{d.producto_nombre}</td>
                <td className="px-4 py-3 text-right">${d.producto_precio.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{d.cantidad}</td>
                <td className="px-4 py-3 text-right font-semibold">${d.subtotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-gray-50">
              <td colSpan={3} className="px-4 py-3 text-right font-semibold">Total</td>
              <td className="px-4 py-3 text-right font-bold">${p.total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold mb-3">Historial</h2>
        <ul className="flex flex-col gap-2">
          {p.historial.map((h) => (
            <li key={h.id} className="flex items-center gap-3 text-sm">
              <span className="text-gray-500 w-44">{new Date(h.changed_at).toLocaleString()}</span>
              <span>
                {h.estado_anterior ? `${h.estado_anterior.codigo} → ` : ''}
                <EstadoBadge estado={h.estado_nuevo.codigo} />
              </span>
              {h.nota && <span className="text-gray-500">— {h.nota}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
