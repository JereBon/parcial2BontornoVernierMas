import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { catalogoApi } from '../api/catalogo';
import type { CategoriaTreeNode } from '../api/types';
import { ProductoCard } from '../components/ProductoCard';
import { SkeletonCards } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';

const LIMIT = 9;

function flattenCategorias(nodes: CategoriaTreeNode[], depth = 0): Array<{ id: number; label: string }> {
  const out: Array<{ id: number; label: string }> = [];
  for (const n of nodes) {
    out.push({ id: n.id, label: `${'-'.repeat(depth)} ${n.nombre}`.trim() });
    if (n.children?.length) out.push(...flattenCategorias(n.children, depth + 1));
  }
  return out;
}

function getDescendantIds(nodes: CategoriaTreeNode[], targetId: number): number[] {
  for (const n of nodes) {
    if (n.id === targetId) {
      const ids: number[] = [n.id];
      const collect = (children: CategoriaTreeNode[]) => {
        for (const c of children) { ids.push(c.id); if (c.children?.length) collect(c.children); }
      };
      if (n.children?.length) collect(n.children);
      return ids;
    }
    if (n.children?.length) {
      const found = getDescendantIds(n.children, targetId);
      if (found.length) return found;
    }
  }
  return [];
}

export default function CatalogoPage() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | ''>('');
  const [precioMax, setPrecioMax] = useState<number | ''>('');

  const categoriasQ = useQuery({
    queryKey: ['catalogo', 'categorias', 'tree'],
    queryFn: catalogoApi.categoriasTree,
  });

  const categoriaOptions = categoriasQ.data ? flattenCategorias(categoriasQ.data) : [];

  const categoria_ids = categoriaId === '' || !categoriasQ.data
    ? undefined
    : getDescendantIds(categoriasQ.data, Number(categoriaId));

  const filters = {
    page: Math.floor(offset / LIMIT) + 1,
    size: LIMIT,
    nombre: search || undefined,
    categoria_ids: categoria_ids?.length ? categoria_ids : undefined,
    precio_max: precioMax === '' ? undefined : Number(precioMax),
    disponible: true,
  };

  const productosQ = useQuery({
    queryKey: ['catalogo', 'productos', filters],
    queryFn: () => catalogoApi.productos(filters),
    placeholderData: keepPreviousData,
  });

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
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          />
        </div>
        <div className="w-56">
          <label className="label">Categoria</label>
          <select
            className="input"
            value={categoriaId}
            onChange={(e) => { setCategoriaId(e.target.value === '' ? '' : Number(e.target.value)); setOffset(0); }}
          >
            <option value="">— Todas —</option>
            {categoriaOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
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
            value={precioMax}
            onChange={(e) => { setPrecioMax(e.target.value === '' ? '' : Number(e.target.value)); setOffset(0); }}
          />
        </div>
      </div>

      {productosQ.isError && (
        <ErrorBanner message={(productosQ.error as Error).message} onRetry={() => productosQ.refetch()} />
      )}

      {productosQ.isLoading ? (
        <SkeletonCards count={LIMIT} />
      ) : productosQ.data?.items.length === 0 ? (
        <div className="card text-center text-gray-500">Sin productos para los filtros aplicados.</div>
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-150 ${productosQ.isFetching ? 'opacity-50' : 'opacity-100'}`}>
          {productosQ.data?.items.map((p) => <ProductoCard key={p.id} producto={p} />)}
        </div>
      )}

      {productosQ.data && (
        <Pagination total={productosQ.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
      )}
    </div>
  );
}
