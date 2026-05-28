import { useState, useEffect, useCallback } from 'react';
import { productosApi } from '../api/productos';
import type { DisponibilidadInput } from '../api/productos';
import type { Producto } from '../models/types';
import { SkeletonRows } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';
import { usePolling } from '../hooks/usePolling';

const LIMIT = 25;

interface RowEdit {
  stock_cantidad?: number | '';
  disponible?: boolean;
}

export default function StockPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [buscar, setBuscar] = useState('');
  const [edits, setEdits] = useState<Record<number, RowEdit>>({});
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await productosApi.list({
        skip: offset,
        limit: LIMIT,
        nombre: buscar || undefined,
      });
      setProductos(data.items);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, [offset, buscar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  usePolling(cargar, 5_000);

  const setEdit = (id: number, patch: RowEdit) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleGuardar = async (id: number) => {
    const edit = edits[id] ?? {};
    const producto = productos.find((p) => p.id === id);
    if (!producto) return;

    const stockDirty = edit.stock_cantidad !== undefined && edit.stock_cantidad !== producto.stock_cantidad;
    const dispDirty = edit.disponible !== undefined && edit.disponible !== producto.disponible;
    const stockValido = edit.stock_cantidad === undefined || (edit.stock_cantidad !== '' && Number(edit.stock_cantidad) >= 0);

    if (!stockDirty && !dispDirty) return;
    if (!stockValido) return;

    setErrorAccion(null);
    setGuardando(true);
    const input: DisponibilidadInput = {};
    if (stockDirty) input.stock_cantidad = Number(edit.stock_cantidad);
    if (dispDirty) input.disponible = edit.disponible;
    try {
      await productosApi.patchDisponibilidad(id, input);
      setEdits((e) => {
        const { [id]: _, ...rest } = e;
        return rest;
      });
      await cargar();
    } catch (err) {
      setErrorAccion((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Stock</h1>
      <p className="text-gray-500 mb-6">Actualiza cantidad y disponibilidad de productos.</p>

      <div className="card mb-4">
        <label className="label">Buscar</label>
        <input
          className="input"
          value={buscar}
          onChange={(e) => { setBuscar(e.target.value); setOffset(0); }}
          placeholder="Nombre del producto..."
        />
      </div>

      {errorAccion && (
        <div className="mb-4">
          <ErrorBanner message={errorAccion} />
        </div>
      )}
      {error && <ErrorBanner message={error} onRetry={cargar} />}

      <div className="card p-0 overflow-hidden">
        {cargando ? (
          <div className="p-4">
            <SkeletonRows count={5} />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head w-16">#</th>
                <th className="table-head">Producto</th>
                <th className="table-head text-right">Precio</th>
                <th className="table-head text-center w-28">Stock</th>
                <th className="table-head text-center w-32">Disponible</th>
                <th className="table-head w-24"></th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => {
                const edit = edits[p.id] ?? {};
                const stockDisplay: number | '' =
                  edit.stock_cantidad !== undefined ? edit.stock_cantidad : p.stock_cantidad;
                const currentDisp = edit.disponible ?? p.disponible;
                const stockDirty = edit.stock_cantidad !== undefined && edit.stock_cantidad !== p.stock_cantidad;
                const dispDirty = edit.disponible !== undefined && edit.disponible !== p.disponible;
                const stockValido = stockDisplay !== '' && Number(stockDisplay) >= 0;
                const dirty = stockDirty || dispDirty;
                const canSave = dirty && stockValido && !guardando;

                return (
                  <tr key={p.id} className="border-t">
                    <td className="table-cell text-gray-500">#{p.id}</td>
                    <td className="table-cell font-medium">{p.nombre}</td>
                    <td className="table-cell text-right">${p.precio.toFixed(2)}</td>
                    <td className="table-cell text-center">
                      <input
                        type="number"
                        min="0"
                        className="input text-center"
                        value={stockDisplay === '' ? '' : stockDisplay}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '') setEdit(p.id, { stock_cantidad: '' });
                          else setEdit(p.id, { stock_cantidad: Math.max(0, Number(v)) });
                        }}
                      />
                    </td>
                    <td className="table-cell text-center">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentDisp}
                          onChange={(e) => setEdit(p.id, { disponible: e.target.checked })}
                        />
                        <span className="text-sm">{currentDisp ? 'Si' : 'No'}</span>
                      </label>
                    </td>
                    <td className="table-cell text-right">
                      <button
                        className="btn-primary text-xs"
                        disabled={!canSave}
                        onClick={() => handleGuardar(p.id)}
                      >
                        Guardar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Pagination total={total} limit={LIMIT} offset={offset} onChange={setOffset} />
    </div>
  );
}
