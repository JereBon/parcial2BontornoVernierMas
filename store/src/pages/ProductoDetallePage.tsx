import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { catalogoApi } from '../api/catalogo';
import type { Producto } from '../models/types';
import { useCarrito } from '../context/CarritoContext';
import { Skeleton } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';

export default function ProductoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const productoId = Number(id);
  const navigate = useNavigate();
  const { addItem } = useCarrito();
  const [cantidad, setCantidad] = useState(1);

  const [producto, setProducto] = useState<Producto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (Number.isNaN(productoId)) return;
    try {
      const data = await catalogoApi.productoById(productoId);
      setProducto(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message ?? 'Producto no encontrado');
    } finally {
      setCargando(false);
    }
  }, [productoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando) {
    return (
      <div className="flex flex-col gap-3 max-w-2xl">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error || !producto) {
    return <ErrorBanner message={error ?? 'Producto no encontrado'} />;
  }

  const p = producto;
  const sinStock = !p.disponible || p.stock_cantidad <= 0;
  const alergenos = p.ingredientes.filter((i) => i.es_alergeno);

  const handleAdd = () => {
    addItem({ producto_id: p.id, nombre: p.nombre, precio: p.precio }, cantidad);
    navigate('/carrito');
  };

  return (
    <div>
      <Link to="/" className="btn-ghost text-orange-600 mb-4 inline-block">
        &larr; Volver al catalogo
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <h1 className="text-3xl font-bold">{p.nombre}</h1>
          <p className="text-3xl font-bold text-orange-600 mt-3">${p.precio.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Stock: {p.stock_cantidad}</p>
          <p className="text-gray-700 mt-4">{p.descripcion || 'Sin descripcion'}</p>

          {p.categorias.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-500">Categorias</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {p.categorias.map((c) => (
                  <span key={c.id} className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">
                    {c.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {p.ingredientes.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-500">Ingredientes</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {p.ingredientes.map((i) => (
                  <span key={i.id} className={`text-xs px-2 py-1 rounded ${
                    i.es_alergeno ? 'bg-red-100 text-red-800 font-semibold' : 'bg-green-100 text-green-800'
                  }`}>
                    {i.nombre}{i.es_alergeno && ' ⚠'}
                  </span>
                ))}
              </div>
              {alergenos.length > 0 && (
                <p className="text-xs text-red-700 mt-2">
                  ⚠ Contiene alergenos: {alergenos.map((a) => a.nombre).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="card h-fit sticky top-20">
          {sinStock ? (
            <p className="text-red-700 font-semibold text-center">
              {!p.disponible ? 'Producto no disponible' : 'Sin stock'}
            </p>
          ) : (
            <>
              <label className="label">Cantidad</label>
              <input
                type="number"
                min="1"
                max={Math.min(99, p.stock_cantidad)}
                className="input mb-4"
                value={cantidad}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setCantidad(Math.max(1, Math.min(p.stock_cantidad, Number(e.target.value))))}
              />
              <button className="btn-primary w-full" onClick={handleAdd}>
                Agregar al carrito — ${(p.precio * cantidad).toFixed(2)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
