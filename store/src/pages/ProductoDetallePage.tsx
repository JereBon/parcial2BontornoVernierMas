import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { catalogoApi } from '../api/catalogo';
import { useCart } from '../cart/CartContext';
import { Skeleton } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';

function ImageCarousel({ imagenes }: { imagenes: string[] }) {
  const [idx, setIdx] = useState(0);

  if (imagenes.length === 0) {
    return (
      <div className="w-full aspect-square bg-gray-100 rounded-xl flex items-center justify-center text-gray-300 text-sm mb-4">
        Sin imagen
      </div>
    );
  }

  if (imagenes.length === 1) {
    return (
      <img src={imagenes[0]} alt="Producto"
        className="w-full aspect-square object-cover rounded-xl mb-4" />
    );
  }

  return (
    <div className="mb-4">
      <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-gray-100">
        <img
          src={imagenes[idx]}
          alt={`Imagen ${idx + 1}`}
          className="w-full h-full object-cover transition-opacity duration-300"
        />
        <button
          onClick={() => setIdx((i) => (i - 1 + imagenes.length) % imagenes.length)}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center text-lg transition-colors"
          aria-label="Anterior"
        >
          ‹
        </button>
        <button
          onClick={() => setIdx((i) => (i + 1) % imagenes.length)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center text-lg transition-colors"
          aria-label="Siguiente"
        >
          ›
        </button>
        <div className="absolute bottom-2 right-3 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full">
          {idx + 1} / {imagenes.length}
        </div>
      </div>
      <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
        {imagenes.map((url, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-colors ${
              i === idx ? 'border-orange-500' : 'border-transparent'
            }`}
          >
            <img src={url} alt={`Miniatura ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProductoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const productoId = Number(id);
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [cantidad, setCantidad] = useState(1);
  const [removidos, setRemovidos] = useState<number[]>([]);

  const productoQ = useQuery({
    queryKey: ['catalogo', 'producto', productoId],
    queryFn: () => catalogoApi.productoById(productoId),
    enabled: !Number.isNaN(productoId),
  });

  if (productoQ.isLoading) {
    return (
      <div className="flex flex-col gap-3 max-w-2xl">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (productoQ.isError || !productoQ.data) {
    return <ErrorBanner message={(productoQ.error as Error)?.message ?? 'Producto no encontrado'} />;
  }

  const p = productoQ.data;
  const sinStock = !p.disponible || p.stock_disponible <= 0;

  const alergenos = p.producto_ingredientes
    .filter((pi) => pi.ingrediente?.es_alergeno)
    .map((pi) => pi.ingrediente!);

  const removibles = p.producto_ingredientes.filter((pi) => pi.es_removible);

  const toggleRemovido = (ingredienteId: number) => {
    setRemovidos((prev) =>
      prev.includes(ingredienteId)
        ? prev.filter((id) => id !== ingredienteId)
        : [...prev, ingredienteId],
    );
  };

  const handleAdd = () => {
    addItem(
      { producto_id: p.id, nombre: p.nombre, precio: p.precio_base },
      cantidad,
      removidos,
    );
    navigate('/carrito');
  };

  return (
    <div>
      <Link to="/" className="btn-ghost text-orange-600 mb-4 inline-block">
        &larr; Volver al catalogo
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <ImageCarousel imagenes={p.imagenes_url ?? []} />

          <h1 className="text-3xl font-bold">{p.nombre}</h1>
          <p className="text-3xl font-bold text-orange-600 mt-3">${p.precio_base.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Stock: {p.stock_disponible}</p>
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

          {p.producto_ingredientes.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-500">Ingredientes</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {p.producto_ingredientes.map((pi) => {
                  const removido = removidos.includes(pi.ingrediente_id);
                  return (
                    <span
                      key={pi.ingrediente_id}
                      className={`text-xs px-2 py-1 rounded transition-opacity ${
                        removido ? 'opacity-40 line-through' : ''
                      } ${
                        pi.ingrediente?.es_alergeno
                          ? 'bg-red-100 text-red-800 font-semibold'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {pi.ingrediente?.nombre}{pi.ingrediente?.es_alergeno && ' ⚠'}
                    </span>
                  );
                })}
              </div>
              {alergenos.length > 0 && (
                <p className="text-xs text-red-700 mt-2">
                  ⚠ Contiene alergenos: {alergenos.map((a) => a.nombre).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="card h-fit sticky top-20 flex flex-col gap-4">
          {sinStock ? (
            <p className="text-red-700 font-semibold text-center">
              {!p.disponible ? 'Producto no disponible' : 'Sin stock'}
            </p>
          ) : (
            <>
              {removibles.length > 0 && (
                <div>
                  <p className="label mb-2">Personalizar (quitar ingredientes)</p>
                  <div className="flex flex-col gap-1.5">
                    {removibles.map((pi) => (
                      <label
                        key={pi.ingrediente_id}
                        className="flex items-center gap-2 text-sm cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={removidos.includes(pi.ingrediente_id)}
                          onChange={() => toggleRemovido(pi.ingrediente_id)}
                          className="accent-orange-500"
                        />
                        <span className={removidos.includes(pi.ingrediente_id) ? 'line-through text-gray-400' : ''}>
                          Sin {pi.ingrediente?.nombre}
                          {pi.ingrediente?.es_alergeno && (
                            <span className="ml-1 text-xs text-red-600">⚠ alergeno</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="label">Cantidad</label>
                <input
                  type="number" min="1" max={Math.min(99, p.stock_disponible)}
                  className="input"
                  value={cantidad}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setCantidad(Math.max(1, Math.min(p.stock_disponible, Number(e.target.value))))}
                />
              </div>

              <button className="btn-primary w-full" onClick={handleAdd}>
                Agregar al carrito — ${(p.precio_base * cantidad).toFixed(2)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
