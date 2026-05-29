import { Link } from 'react-router-dom';
import type { Producto } from '../models/types';
import { useCarrito } from '../context/CarritoContext';

export function ProductoCard({ producto }: { producto: Producto }) {
  const { addItem } = useCarrito();
  const noStock = producto.stock_cantidad <= 0;
  const sinStockODispo = !producto.disponible || noStock;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (sinStockODispo) return;
    addItem({
      producto_id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      stock_cantidad: producto.stock_cantidad,
    });
  };

  const alergenos = producto.ingredientes.filter((i) => i.es_alergeno);

  return (
    <Link to={`/producto/${producto.id}`} className="card-hover flex flex-col group">
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
      <p className="text-2xl font-bold text-orange-600 mt-1">${producto.precio.toFixed(2)}</p>
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
