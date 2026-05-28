import { useId, useEffect, useState, useCallback } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { pedidosApi, type PedidoInput } from '../api/pedidos';
import { direccionesApi } from '../api/direcciones';
import { lookupsApi } from '../api/lookups';
import { catalogoApi } from '../api/catalogo';
import type { DireccionEntrega, FormaPago } from '../models/types';
import { useCarrito } from '../context/CarritoContext';
import { useAuth } from '../context/AuthContext';

export default function CheckoutPage() {
  const { items, total, clear, setPrice } = useCarrito();
  const { user } = useAuth();
  const navigate = useNavigate();

  const direccionId = useId();
  const formaPagoId = useId();
  const notasId = useId();

  const [direcciones, setDirecciones] = useState<DireccionEntrega[]>([]);
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [direccionSeleccionada, setDireccionSeleccionada] = useState<number | ''>('');
  const [formaPagoSeleccionada, setFormaPagoSeleccionada] = useState<number | ''>('');
  const [notas, setNotas] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const actualizarPrecios = useCallback(async () => {
    if (items.length === 0) return;
    try {
      const resultados = await Promise.all(
        items.map((i) => catalogoApi.productoById(i.producto_id)),
      );
      resultados.forEach((data, idx) => {
        const item = items[idx];
        if (!data || !item) return;
        if (data.precio !== item.precio || data.nombre !== item.nombre) {
          setPrice(item.producto_id, data.precio, data.nombre);
        }
      });
    } catch {
      // no fatal
    }
  }, [items, setPrice]);

  useEffect(() => {
    actualizarPrecios();
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([direccionesApi.list(), lookupsApi.formasPago()])
      .then(([dirs, fps]) => {
        setDirecciones(dirs);
        setFormasPago(fps);
        if (dirs.length > 0) {
          const principal = dirs.find((d) => d.principal) ?? dirs[0];
          setDireccionSeleccionada(principal.id);
        }
        if (fps.length > 0) setFormaPagoSeleccionada(fps[0].id);
      })
      .catch(() => {});
  }, [user]);

  if (!user) {
    return <Navigate to="/login" state={{ from: { pathname: '/checkout' } }} replace />;
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-2">Tu carrito esta vacio</h1>
        <Link to="/" className="btn-primary mt-4 inline-block">Volver al catalogo</Link>
      </div>
    );
  }

  const hasDirecciones = direcciones.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (direccionSeleccionada === '' || formaPagoSeleccionada === '') {
      setServerError('Tenes que elegir direccion y forma de pago');
      return;
    }
    setServerError(null);
    setEnviando(true);
    const input: PedidoInput = {
      direccion_id: Number(direccionSeleccionada),
      forma_pago_id: Number(formaPagoSeleccionada),
      notas: notas.trim() || null,
      items: items.map((i) => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
    };
    try {
      const pedido = await pedidosApi.create(input);
      clear();
      navigate(`/mis-pedidos/${pedido.id}`, { replace: true });
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Finalizar compra</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form className="lg:col-span-2 card flex flex-col gap-4" onSubmit={handleSubmit}>
          <h2 className="font-semibold">Direccion de entrega</h2>

          {!hasDirecciones ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded p-3">
              No tenes direcciones cargadas.{' '}
              <Link to="/direcciones" className="font-semibold underline">
                Agregar una direccion
              </Link>
            </div>
          ) : (
            <div>
              <select
                id={direccionId}
                className="input"
                value={direccionSeleccionada}
                onChange={(e) => setDireccionSeleccionada(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">— Elegi una —</option>
                {direcciones.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.alias} — {d.calle} {d.numero}, {d.ciudad}{d.principal ? ' (principal)' : ''}
                  </option>
                ))}
              </select>
              <Link to="/direcciones" className="text-xs text-orange-600 hover:underline mt-1 inline-block">
                Administrar direcciones
              </Link>
            </div>
          )}

          <h2 className="font-semibold mt-2">Forma de pago</h2>
          <select
            id={formaPagoId}
            className="input"
            value={formaPagoSeleccionada}
            onChange={(e) => setFormaPagoSeleccionada(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">— Elegi una —</option>
            {formasPago.map((fp) => (
              <option key={fp.id} value={fp.id}>{fp.nombre}</option>
            ))}
          </select>

          <div>
            <label htmlFor={notasId} className="label">Notas (opcional)</label>
            <textarea
              id={notasId}
              className="input"
              rows={3}
              placeholder="Aclaraciones para el repartidor, alergias, etc."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-3">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary mt-2"
            disabled={enviando || !hasDirecciones}
          >
            {enviando ? 'Procesando...' : `Confirmar pedido — $${total.toFixed(2)}`}
          </button>
        </form>

        <div className="card h-fit">
          <h2 className="font-semibold mb-4">Tu pedido</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {items.map((i) => (
              <li key={i.producto_id} className="flex justify-between">
                <span>{i.cantidad} × {i.nombre}</span>
                <span>${(i.precio * i.cantidad).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t pt-3 mt-3">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold text-orange-600">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
