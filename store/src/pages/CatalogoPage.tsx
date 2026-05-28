import { useState, useEffect, useCallback } from 'react';
import { catalogoApi } from '../api/catalogo';
import type { CategoriaTreeNode, Paginated, Producto } from '../models/types';
import { ProductoCard } from '../components/ProductoCard';
import { SkeletonCards } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';
import { useFiltrosCatalogo } from '../hooks/useFiltrosCatalogo';

const LIMIT = 9;

function flattenCategorias(nodes: CategoriaTreeNode[], depth = 0): Array<{ id: number; label: string }> {
  const out: Array<{ id: number; label: string }> = [];
  for (const n of nodes) {
    out.push({ id: n.id, label: `${'-'.repeat(depth)} ${n.nombre}`.trim() });
    if (n.children?.length) out.push(...flattenCategorias(n.children, depth + 1));
  }
  return out;
}

export default function CatalogoPage() {
  const { filtros, setFiltros } = useFiltrosCatalogo();
  const [offset, setOffset] = useState(0);

  const [data, setData] = useState<Paginated<Producto> | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoriaOptions, setCategoriaOptions] = useState<Array<{ id: number; label: string }>>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const result = await catalogoApi.productos({
        skip: offset,
        limit: LIMIT,
        nombre: filtros.buscar || undefined,
        categoria_id: filtros.categoriaId === '' ? undefined : Number(filtros.categoriaId),
        precio_max: filtros.precioMax === '' ? undefined : Number(filtros.precioMax),
        disponible: true,
      });
      setData(result);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, [offset, filtros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    catalogoApi.categoriasTree()
      .then((tree) => setCategoriaOptions(flattenCategorias(tree)))
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Catalogo</h1>
      <p className="text-gray-600 mb-6">Elegi tus productos y agregalos al carrito.</p>

      <div className="card mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-48">
          <label className="label">Buscar</label>
          <input
            className="input"
            placeholder="Nombre del producto..."
            value={filtros.buscar}
            onChange={(e) => { setFiltros((p) => ({ ...p, buscar: e.target.value })); setOffset(0); }}
          />
        </div>
        <div className="w-56">
          <label className="label">Categoria</label>
          <select
            className="input"
            value={filtros.categoriaId}
            onChange={(e) => {
              setFiltros((p) => ({ ...p, categoriaId: e.target.value === '' ? '' : Number(e.target.value) }));
              setOffset(0);
            }}
          >
            <option value="">— Todas —</option>
            {categoriaOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="w-40">
          <label className="label">Precio max</label>
          <input
            className="input"
            type="number"
            min="0"
            step="1"
            placeholder="Sin limite"
            value={filtros.precioMax}
            onChange={(e) => {
              setFiltros((p) => ({ ...p, precioMax: e.target.value === '' ? '' : Number(e.target.value) }));
              setOffset(0);
            }}
          />
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={cargar} />}

      {cargando ? (
        <SkeletonCards count={LIMIT} />
      ) : data?.items.length === 0 ? (
        <div className="card text-center text-gray-500">Sin productos para los filtros aplicados.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.items.map((p) => <ProductoCard key={p.id} producto={p} />)}
        </div>
      )}

      <Pagination total={data?.total ?? 0} limit={LIMIT} offset={offset} onChange={setOffset} />
    </div>
  );
}
