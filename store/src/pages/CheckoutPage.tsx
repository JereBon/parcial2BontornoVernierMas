import { useEffect, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { pedidosApi, type PedidoInput } from '../api/pedidos';
import { direccionesApi } from '../api/direcciones';
import { lookupsApi } from '../api/lookups';
import { catalogoApi } from '../api/catalogo';
import { useCart } from '../cart/CartContext';
import { useAuth } from '../auth/AuthContext';

interface CheckoutForm {
  direccion_id: number | '';
  forma_pago_id: number | '';
  notas: string;
}

export default function CheckoutPage() {
  const { items, total, clear, setPrice } = useCart();
  const { user } = useAuth();

  const productosQ = useQueries({
    queries: items.map((i) => ({
      queryKey: ['catalogo', 'producto', i.producto_id],
      queryFn: () => catalogoApi.productoById(i.producto_id),
      refetchInterval: 10_000,
      staleTime: 5_000,
    })),
  });

  useEffect(() => {
    productosQ.forEach((q, idx) => {
      const data = q.data;
      const item = items[idx];
      if (!data || !item) return;
      if (data.precio_base !== item.precio || data.nombre !== item.nombre) {
        setPrice(item.producto_id, data.precio_base, data.nombre);
      }
    });

  }, [productosQ.map((q) => q.data?.precio_base).join('|')]);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const direccionesQ = useQuery({
    queryKey: ['direcciones'],
    queryFn: direccionesApi.list,
    enabled: !!user,
  });

  const formasPagoQ = useQuery({
    queryKey: ['lookups', 'formas-pago'],
    queryFn: lookupsApi.formasPago,
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: async (input: PedidoInput) => {
      const pedido = await pedidosApi.create(input);
      const forma = formasPagoQ.data?.find((fp) => fp.id === input.forma_pago_id);
      if (forma?.codigo === 'MERCADOPAGO') {
        const pref = await pedidosApi.crearPago(pedido.id);
        setRedirecting(true);
        clear();
        window.location.href = pref.init_point;
        return null;
      }
      return pedido;
    },
    onSuccess: (pedido) => {
      if (!pedido) return;
      qc.invalidateQueries({ queryKey: ['pedidos'] });
      clear();
      navigate(`/mis-pedidos/${pedido.id}`, { replace: true });
    },
    onError: (err) => setServerError((err as Error).message),
  });

  const form = useForm({
    defaultValues: {
      direccion_id: '' as number | '',
      forma_pago_id: '' as number | '',
      notas: '',
    } as CheckoutForm,
    onSubmit: async ({ value }) => {
      setServerError(null);
      if (value.direccion_id === '' || value.forma_pago_id === '') {
        setServerError('Tenes que elegir direccion y forma de pago');
        return;
      }
      const input: PedidoInput = {
        direccion_id: Number(value.direccion_id),
        forma_pago_id: Number(value.forma_pago_id),
        notas: value.notas.trim() || null,
        items: items.map((i) => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
          personalizacion: i.personalizacion.length > 0 ? i.personalizacion : null,
        })),
      };
      await createMut.mutateAsync(input);
    },
  });

  useEffect(() => {
    if (form.state.values.direccion_id === '' && direccionesQ.data && direccionesQ.data.length > 0) {
      const principal = direccionesQ.data.find((d) => d.es_principal) ?? direccionesQ.data[0];
      form.setFieldValue('direccion_id', principal.id);
    }
    if (form.state.values.forma_pago_id === '' && formasPagoQ.data && formasPagoQ.data.length > 0) {
      form.setFieldValue('forma_pago_id', formasPagoQ.data[0].id);
    }
  }, [direccionesQ.data, formasPagoQ.data, form]);

  if (!user) {
    return <Navigate to="/login" state={{ from: { pathname: '/checkout' } }} replace />;
  }

  if (items.length === 0 && !redirecting) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-2">Tu carrito esta vacio</h1>
        <Link to="/" className="btn-primary mt-4 inline-block">Volver al catalogo</Link>
      </div>
    );
  }

  const hasDirecciones = (direccionesQ.data?.length ?? 0) > 0;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Finalizar compra</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form className="lg:col-span-2 card flex flex-col gap-4"
          onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
          <h2 className="font-semibold">Direccion de entrega</h2>

          {!hasDirecciones ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded p-3">
              No tenes direcciones cargadas.{' '}
              <Link to="/direcciones?from=checkout" className="font-semibold underline">
                Agregar una direccion
              </Link>
            </div>
          ) : (
            <form.Field name="direccion_id" validators={{
              onChange: ({ value }) => (value === '' ? 'Elegi una direccion' : undefined),
            }}>
              {(field) => (
                <div>
                  <select className="input" value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value === '' ? '' : Number(e.target.value))}>
                    <option value="">— Elegi una —</option>
                    {direccionesQ.data?.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.alias ?? 'Sin alias'} — {d.linea1}{d.linea2 ? `, ${d.linea2}` : ''}, {d.ciudad}{d.es_principal ? ' (principal)' : ''}
                      </option>
                    ))}
                  </select>
                  <Link to="/direcciones" className="text-xs text-orange-600 hover:underline mt-1 inline-block">
                    Administrar direcciones
                  </Link>
                </div>
              )}
            </form.Field>
          )}

          <h2 className="font-semibold mt-2">Forma de pago</h2>
          <form.Field name="forma_pago_id" validators={{
            onChange: ({ value }) => (value === '' ? 'Elegi una forma de pago' : undefined),
          }}>
            {(field) => (
              <select className="input" value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">— Elegi una —</option>
                {formasPagoQ.data?.map((fp) => (
                  <option key={fp.id} value={fp.id}>{fp.descripcion}</option>
                ))}
              </select>
            )}
          </form.Field>

          <form.Field name="notas">
            {(field) => (
              <div>
                <label htmlFor={field.name} className="label">Notas (opcional)</label>
                <textarea id={field.name} className="input" rows={3}
                  placeholder="Aclaraciones para el repartidor, alergias, etc."
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} />
              </div>
            )}
          </form.Field>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-3">
              {serverError}
            </div>
          )}

          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => (
              <button type="submit" className="btn-primary mt-2"
                disabled={!canSubmit || !hasDirecciones}>
                {isSubmitting ? 'Procesando...' : `Confirmar pedido — $${total.toFixed(2)}`}
              </button>
            )}
          </form.Subscribe>
        </form>

        <div className="card h-fit">
          <h2 className="font-semibold mb-4">Tu pedido</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {items.map((i, idx) => {
              const prodData = productosQ[idx]?.data;
              const nombresRemovidos = i.personalizacion.map((ingId) => {
                const pi = prodData?.producto_ingredientes.find((x) => x.ingrediente_id === ingId);
                return pi?.ingrediente?.nombre ?? `#${ingId}`;
              });
              return (
                <li key={i.producto_id}>
                  <div className="flex justify-between">
                    <span>{i.cantidad} × {i.nombre}</span>
                    <span>${(i.precio * i.cantidad).toFixed(2)}</span>
                  </div>
                  {i.personalizacion.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Sin: {nombresRemovidos.join(', ')}
                    </p>
                  )}
                </li>
              );
            })}
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
