import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productosApi, type DisponibilidadInput } from '../api/productos';
import { ingredientesApi } from '../api/ingredientes';
import { api } from '../api/client';
import type { Ingrediente } from '../api/types';
import { SkeletonRows } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';

const LIMIT = 25;

export default function StockPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'ingredientes' | 'productos'>('ingredientes');

  // — Ingredientes —
  const [ingOffset, setIngOffset] = useState(0);
  const [ingSearch, setIngSearch] = useState('');
  const [ingEdits, setIngEdits] = useState<Record<number, number | ''>>({});
  const [ingError, setIngError] = useState<string | null>(null);

  const ingQ = useQuery({
    queryKey: ['ingredientes', 'stock', { ingOffset, ingSearch }],
    queryFn: () => ingredientesApi.list({ skip: ingOffset, limit: LIMIT, nombre: ingSearch || undefined }),
    refetchInterval: 5_000,
    placeholderData: (prev) => prev,
  });

  const ingStockMut = useMutation({
    mutationFn: ({ id, stock_cantidad }: { id: number; stock_cantidad: number }) =>
      api.patch<Ingrediente>(`/ingredientes/${id}/stock`, { stock_cantidad }).then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ingredientes'] });
      qc.invalidateQueries({ queryKey: ['productos'] });
      setIngEdits((prev) => { const { [vars.id]: _, ...rest } = prev; return rest; });
    },
    onError: (err) => setIngError((err as Error).message),
  });

  // — Productos —
  const [prodOffset, setProdOffset] = useState(0);
  const [prodSearch, setProdSearch] = useState('');
  const [pendingDisp, setPendingDisp] = useState<Record<number, boolean>>({});
  const [prodError, setProdError] = useState<string | null>(null);

  const prodQ = useQuery({
    queryKey: ['productos', 'stock', { prodOffset, prodSearch }],
    queryFn: () => productosApi.list({ skip: prodOffset, limit: LIMIT, nombre: prodSearch || undefined }),
    refetchInterval: 5_000,
    placeholderData: (prev) => prev,
  });

  const dispMut = useMutation({
    mutationFn: ({ id, input }: { id: number; input: DisponibilidadInput }) =>
      productosApi.patchDisponibilidad(id, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['productos'] });
      setPendingDisp((prev) => { const { [vars.id]: _, ...rest } = prev; return rest; });
    },
    onError: (err) => setProdError((err as Error).message),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Stock</h1>
      <p className="text-gray-500 mb-5 text-sm">
        Gestioná el stock de ingredientes (que determina el stock disponible de productos) y la disponibilidad de cada producto.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b">
        {(['ingredientes', 'productos'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'ingredientes' ? 'Ingredientes (stock)' : 'Productos (disponibilidad)'}
          </button>
        ))}
      </div>

      {/* ── TAB INGREDIENTES ── */}
      {tab === 'ingredientes' && (
        <div>
          <div className="card mb-4">
            <label className="label">Buscar ingrediente</label>
            <input className="input" value={ingSearch}
              onChange={(e) => { setIngSearch(e.target.value); setIngOffset(0); }}
              placeholder="Nombre..." />
          </div>

          {ingError && <div className="mb-4"><ErrorBanner message={ingError} /></div>}
          {ingQ.isError && (
            <ErrorBanner message={(ingQ.error as Error).message} onRetry={() => ingQ.refetch()} />
          )}

          <div className="card p-0 overflow-hidden">
            {ingQ.isLoading ? (
              <div className="p-4"><SkeletonRows count={5} /></div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-head w-16">#</th>
                    <th className="table-head">Ingrediente</th>
                    <th className="table-head text-center w-24">Unidad</th>
                    <th className="table-head text-center w-40">Stock actual</th>
                    <th className="table-head w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {ingQ.data?.items.map((ing: Ingrediente) => {
                    const editVal = ingEdits[ing.id];
                    const display = editVal !== undefined ? editVal : ing.stock_cantidad;
                    const dirty = editVal !== undefined && editVal !== ing.stock_cantidad;
                    const valid = display !== '' && Number(display) >= 0;

                    return (
                      <tr key={ing.id} className="border-t">
                        <td className="table-cell text-gray-500">#{ing.id}</td>
                        <td className="table-cell">
                          <span className="font-medium">{ing.nombre}</span>
                          {ing.es_alergeno && (
                            <span className="ml-2 text-xs text-red-600 font-semibold">⚠ alergeno</span>
                          )}
                        </td>
                        <td className="table-cell text-center text-gray-500 text-sm">
                          {ing.unidad_medida?.simbolo ?? '—'}
                        </td>
                        <td className="table-cell text-center">
                          <input type="number" min="0" className="input text-center w-28"
                            value={display === '' ? '' : display}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const v = e.target.value;
                              setIngEdits((prev) => ({
                                ...prev,
                                [ing.id]: v === '' ? '' : Math.max(0, Number(v)),
                              }));
                            }} />
                        </td>
                        <td className="table-cell text-right">
                          <button className="btn-primary text-xs"
                            disabled={!dirty || !valid || ingStockMut.isPending}
                            onClick={() => {
                              setIngError(null);
                              ingStockMut.mutate({ id: ing.id, stock_cantidad: Number(display) });
                            }}>
                            Guardar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {ingQ.data?.items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="table-cell text-center text-gray-500">Sin resultados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {ingQ.data && (
            <Pagination total={ingQ.data.total} limit={LIMIT} offset={ingOffset} onChange={setIngOffset} />
          )}
        </div>
      )}

      {/* ── TAB PRODUCTOS ── */}
      {tab === 'productos' && (
        <div>
          <div className="card mb-4">
            <label className="label">Buscar producto</label>
            <input className="input" value={prodSearch}
              onChange={(e) => { setProdSearch(e.target.value); setProdOffset(0); }}
              placeholder="Nombre..." />
          </div>

          {prodError && <div className="mb-4"><ErrorBanner message={prodError} /></div>}
          {prodQ.isError && (
            <ErrorBanner message={(prodQ.error as Error).message} onRetry={() => prodQ.refetch()} />
          )}

          <div className="card p-0 overflow-hidden">
            {prodQ.isLoading ? (
              <div className="p-4"><SkeletonRows count={5} /></div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-head w-16">#</th>
                    <th className="table-head">Producto</th>
                    <th className="table-head text-right">Precio</th>
                    <th className="table-head text-center w-36">Stock calculado</th>
                    <th className="table-head text-center w-36">Disponible</th>
                    <th className="table-head w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {prodQ.data?.items.map((p) => {
                    const currentDisp = pendingDisp[p.id] ?? p.disponible;
                    const dirty = pendingDisp[p.id] !== undefined && pendingDisp[p.id] !== p.disponible;

                    return (
                      <tr key={p.id} className="border-t">
                        <td className="table-cell text-gray-500">#{p.id}</td>
                        <td className="table-cell font-medium">{p.nombre}</td>
                        <td className="table-cell text-right">${p.precio_base.toFixed(2)}</td>
                        <td className="table-cell text-center">
                          <span className={`font-semibold text-sm ${
                            p.stock_disponible > 0 ? 'text-green-700' : 'text-red-600'
                          }`}>
                            {p.stock_disponible}
                          </span>
                          <span className="text-xs text-gray-400 ml-1">(calculado)</span>
                        </td>
                        <td className="table-cell text-center">
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={currentDisp}
                              onChange={(e) =>
                                setPendingDisp((prev) => ({ ...prev, [p.id]: e.target.checked }))
                              } />
                            <span className="text-sm">{currentDisp ? 'Sí' : 'No'}</span>
                          </label>
                        </td>
                        <td className="table-cell text-right">
                          <button className="btn-primary text-xs"
                            disabled={!dirty || dispMut.isPending}
                            onClick={() => {
                              setProdError(null);
                              dispMut.mutate({ id: p.id, input: { disponible: currentDisp } });
                            }}>
                            Guardar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {prodQ.data?.items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="table-cell text-center text-gray-500">Sin resultados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {prodQ.data && (
            <Pagination total={prodQ.data.total} limit={LIMIT} offset={prodOffset} onChange={setProdOffset} />
          )}
        </div>
      )}
    </div>
  );
}
