import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { pedidosApi } from '../api/pedidos';
import type { EstadoPedidoCodigo, PedidoFull } from '../models/types';
import { Skeleton } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { EstadoBadge } from '../components/EstadoBadge';
import { usePolling } from '../hooks/usePolling';

const NEXT_STATE: Partial<Record<EstadoPedidoCodigo, EstadoPedidoCodigo>> = {
  PENDIENTE: 'CONFIRMADO',
  CONFIRMADO: 'EN_PREPARACION',
  EN_PREPARACION: 'EN_CAMINO',
  EN_CAMINO: 'ENTREGADO',
};

const TERMINAL: EstadoPedidoCodigo[] = ['ENTREGADO', 'CANCELADO'];

export default function PedidoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);

  const [pedido, setPedido] = useState<PedidoFull | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorPagina, setErrorPagina] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    if (Number.isNaN(pedidoId)) return;
    try {
      const data = await pedidosApi.get(pedidoId);
      setPedido(data);
      setErrorPagina(null);
    } catch (err) {
      setErrorPagina((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  usePolling(cargar, 5_000);

  const avanzarEstado = async (nuevoEstado: EstadoPedidoCodigo) => {
    setProcesando(true);
    setErrorAccion(null);
    try {
      const actualizado = await pedidosApi.cambiarEstado(pedidoId, nuevoEstado);
      setPedido(actualizado);
    } catch (err) {
      setErrorAccion((err as Error).message);
    } finally {
      setProcesando(false);
    }
  };

  const handleCancelar = async () => {
    if (!confirm('Cancelar este pedido?')) return;
    setProcesando(true);
    setErrorAccion(null);
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

  if (errorPagina || !pedido) {
    return <ErrorBanner message={errorPagina ?? 'Pedido no encontrado'} onRetry={cargar} />;
  }

  const estadoCodigo = pedido.estado.codigo;
  const next = NEXT_STATE[estadoCodigo];
  const isTerminal = TERMINAL.includes(estadoCodigo);

  return (
    <div>
      <Link to="/pedidos" className="btn-ghost text-blue-600 mb-4 inline-block">
        &larr; Volver
      </Link>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Pedido #{pedido.id}</h1>
        <EstadoBadge estado={estadoCodigo} />
      </div>

      {errorAccion && (
        <div className="mb-4">
          <ErrorBanner message={errorAccion} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-3">Datos</h2>
          <p className="text-sm text-gray-500">Cliente</p>
          <p className="mb-2">usuario #{pedido.usuario_id}</p>
          <p className="text-sm text-gray-500">Direccion (snapshot)</p>
          <p className="mb-2">{pedido.direccion_snapshot}</p>
          <p className="text-sm text-gray-500">Forma de pago</p>
          <p className="mb-2">{pedido.forma_pago.nombre}</p>
          {pedido.notas && (
            <>
              <p className="text-sm text-gray-500">Notas</p>
              <p className="mb-2">{pedido.notas}</p>
            </>
          )}
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-blue-600">${pedido.total.toFixed(2)}</p>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3">Acciones</h2>
          {isTerminal ? (
            <p className="text-gray-500 text-sm">Estado terminal — no admite cambios.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {next && (
                <button
                  className="btn-primary"
                  disabled={procesando}
                  onClick={() => avanzarEstado(next)}
                >
                  Avanzar a {next}
                </button>
              )}
              <button
                className="btn-danger"
                disabled={procesando}
                onClick={handleCancelar}
              >
                Cancelar pedido
              </button>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3">Fechas</h2>
          <p className="text-sm text-gray-500">Creado</p>
          <p className="mb-2">{new Date(pedido.created_at).toLocaleString()}</p>
          <p className="text-sm text-gray-500">Actualizado</p>
          <p>{new Date(pedido.updated_at).toLocaleString()}</p>
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
            {pedido.detalles.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="table-cell font-medium">{d.producto_nombre}</td>
                <td className="table-cell text-right">${d.producto_precio.toFixed(2)}</td>
                <td className="table-cell text-right">{d.cantidad}</td>
                <td className="table-cell text-right font-semibold">
                  ${d.subtotal.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-gray-50">
              <td colSpan={3} className="table-cell text-right font-semibold">
                Total
              </td>
              <td className="table-cell text-right font-bold">${pedido.total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold mb-3">Historial</h2>
        <ul className="flex flex-col gap-2">
          {pedido.historial.map((h) => (
            <li key={h.id} className="flex items-center gap-3 text-sm">
              <span className="text-gray-500 w-44">
                {new Date(h.changed_at).toLocaleString()}
              </span>
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
