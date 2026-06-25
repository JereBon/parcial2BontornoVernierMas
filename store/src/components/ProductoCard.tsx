import { Link } from 'react-router-dom';
import type { Producto } from '../api/types';
import { useCart } from '../cart/CartContext';
import { useToastStore } from '../stores/toastStore';

export function ProductoCard({ producto }: { producto: Producto }) {
  const { addItem } = useCart();
  const pushToast = useToastStore((s) => s.push);
  const noStock = producto.stock_disponible <= 0;
  const sinStockODispo = !producto.disponible || noStock;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (sinStockODispo) return;
    addItem({
      producto_id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio_base,
    });
    pushToast(`${producto.nombre} agregado al carrito`, 'success');
  };

  const alergenos = producto.producto_ingredientes
    .filter((pi) => pi.ingrediente?.es_alergeno)
    .map((pi) => pi.ingrediente!);

  const imagen = producto.imagenes_url?.[0];

  return (
    <Link to={`/producto/${producto.id}`} className="card-hover flex flex-col group">
      {imagen ? (
        <img src={imagen} alt={producto.nombre}
          className="w-full h-36 object-cover rounded-md mb-3" />
      ) : (
        <div className="w-full h-36 bg-gray-100 rounded-md mb-3 flex items-center justify-center text-gray-300 text-xs">
          Sin imagen
        </div>
      )}
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold group-hover:text-orange-600 transition-colors">
          {producto.nombre}
        </h3>
        {sinStockODispo && (
          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
            {!producto.disponible ? 'NO DISPONIBLE' : 'SIN STOCK'}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-orange-600 mt-1">${producto.precio_base.toFixed(2)}</p>
      <p className="text-sm text-gray-600 mt-2 min-h-10 line-clamp-2">
        {producto.descripcion || 'Sin descripcion'}
      </p>
      <div className="flex flex-wrap gap-1 mt-3 min-h-6">
        {producto.categorias.slice(0, 3).map((c) => (
          <span key={c.id} className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded">
            {c.nombre}
          </span>
        ))}
      </div>
      {alergenos.length > 0 && (
        <p className="text-xs text-red-700 mt-1">
          ⚠ Contiene: {alergenos.map((a) => a.nombre).join(', ')}
        </p>
      )}
      <button onClick={handleAdd} className="btn-primary mt-4 w-full" disabled={sinStockODispo}>
        {sinStockODispo ? 'No disponible' : 'Agregar al carrito'}
      </button>
    </Link>
  );
}
