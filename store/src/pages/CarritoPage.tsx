import { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { catalogoApi } from '../api/catalogo';
import { useCarrito } from '../context/CarritoContext';

export default function CarritoPage() {
  const { items, total, setQty, removeItem, clear, setPrice } = useCarrito();

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
      // precios no actualizados — no fatal
    }
  }, [items, setPrice]);

  useEffect(() => {
    actualizarPrecios();
  }, []);

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-2">Tu carrito esta vacio</h1>
        <p className="text-gray-500 mb-6">Agrega productos desde el catalogo.</p>
        <Link to="/" className="btn-primary">Ir al catalogo</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Mi carrito</h1>
        <button className="btn-ghost text-red-600" onClick={clear}>Vaciar carrito</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Producto</th>
                <th className="text-right text-xs font-semibold text-gray-600 uppercase px-4 py-3">Precio</th>
                <th className="text-center text-xs font-semibold text-gray-600 uppercase px-4 py-3 w-28">Cantidad</th>
                <th className="text-right text-xs font-semibold text-gray-600 uppercase px-4 py-3">Subtotal</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.producto_id} className="border-t">
                  <td className="px-4 py-3 font-medium">{i.nombre}</td>
                  <td className="px-4 py-3 text-right">${i.precio.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      className="input text-center"
                      value={i.cantidad}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setQty(i.producto_id, Math.max(1, Number(e.target.value)))}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">${(i.precio * i.cantidad).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => removeItem(i.producto_id)}
                      className="text-red-600 hover:text-red-800"
                      aria-label="Eliminar"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card h-fit">
          <h2 className="font-semibold mb-4">Resumen</h2>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Items</span>
            <span>{items.reduce((acc, i) => acc + i.cantidad, 0)}</span>
          </div>
          <div className="flex justify-between border-t pt-3 mt-3">
            <span className="font-semibold">Total</span>
            <span className="text-2xl font-bold text-orange-600">${total.toFixed(2)}</span>
          </div>
          <Link to="/checkout" className="btn-primary w-full mt-6">Finalizar compra</Link>
          <p className="text-xs text-gray-500 mt-3 text-center">
            Los precios se actualizan automaticamente al abrir el carrito.
          </p>
        </div>
      </div>
    </div>
  );
}
