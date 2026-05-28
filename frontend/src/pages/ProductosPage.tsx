import { useState, useEffect, useCallback, useRef, useId, useReducer } from 'react';
import { productosApi } from '../api/productos';
import type { ProductoInput, ProductoIngredienteInput } from '../api/productos';
import { categoriasApi } from '../api/categorias';
import { ingredientesApi } from '../api/ingredientes';
import type { Categoria, Ingrediente, Producto } from '../models/types';
import { Modal } from '../components/Modal';
import { SkeletonCards } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';
import { productosReducer, productosEstadoInicial } from '../reducers/productosReducer';
import { useFiltrosProductos } from '../hooks/useFiltrosProductos';

const LIMIT = 12;

export default function ProductosPage() {
  const [state, dispatch] = useReducer(productosReducer, productosEstadoInicial);
  const { filtros, setFiltros } = useFiltrosProductos();
  const [offset, setOffset] = useState(0);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const nombreId = useId();
  const precioId = useId();
  const stockId = useId();
  const descripcionId = useId();
  const nombreRef = useRef<HTMLInputElement>(null);

  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState<number | ''>('');
  const [stockCantidad, setStockCantidad] = useState<number | ''>('');
  const [descripcion, setDescripcion] = useState('');
  const [disponible, setDisponible] = useState(true);
  const [categoriasIds, setCategoriasIds] = useState<number[]>([]);
  const [ingredientesSeleccionados, setIngredientesSeleccionados] = useState<
    ProductoIngredienteInput[]
  >([]);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const cargar = useCallback(async () => {
    dispatch({ type: 'CARGAR_INICIO' });
    try {
      const data = await productosApi.list({
        skip: offset,
        limit: LIMIT,
        nombre: filtros.buscar || undefined,
        categoria_id:
          filtros.categoriaId === '' ? undefined : Number(filtros.categoriaId),
        disponible:
          filtros.disponible === 'todos'
            ? undefined
            : filtros.disponible === 'si',
      });
      dispatch({ type: 'CARGAR_EXITO', payload: data });
    } catch (err) {
      dispatch({ type: 'CARGAR_ERROR', payload: (err as Error).message });
    }
  }, [offset, filtros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    categoriasApi.list({ limit: 100 }).then((d) => setCategorias(d.items)).catch(() => null);
    ingredientesApi.list({ limit: 100 }).then((d) => setIngredientes(d.items)).catch(() => null);
  }, []);

  useEffect(() => {
    if (modalAbierto) setTimeout(() => nombreRef.current?.focus(), 50);
  }, [modalAbierto]);

  const resetForm = () => {
    setNombre('');
    setPrecio('');
    setStockCantidad('');
    setDescripcion('');
    setDisponible(true);
    setCategoriasIds([]);
    setIngredientesSeleccionados([]);
    setErrores({});
    setErrorForm(null);
  };

  const abrirCrear = () => {
    setEditando(null);
    resetForm();
    setModalAbierto(true);
  };

  const abrirEditar = (p: Producto) => {
    setEditando(p);
    setNombre(p.nombre);
    setPrecio(p.precio);
    setStockCantidad(p.stock_cantidad);
    setDescripcion(p.descripcion ?? '');
    setDisponible(p.disponible);
    setCategoriasIds(p.categorias.map((c) => c.id));
    setIngredientesSeleccionados(
      p.ingredientes.map((i) => ({ ingrediente_id: i.id, es_alergeno: i.es_alergeno })),
    );
    setErrores({});
    setErrorForm(null);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditando(null);
  };

  const validar = () => {
    const e: Record<string, string> = {};
    if (!nombre || nombre.trim().length < 2) e.nombre = 'Minimo 2 caracteres';
    if (precio === '' || Number(precio) <= 0) e.precio = 'Debe ser > 0';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    setErrorForm(null);
    setGuardando(true);
    const payload: ProductoInput = {
      nombre: nombre.trim(),
      precio: Number(precio),
      descripcion: descripcion.trim() || null,
      stock_cantidad: Math.max(0, Math.floor(Number(stockCantidad))),
      disponible,
      categorias_ids: categoriasIds,
      ingredientes: ingredientesSeleccionados,
    };
    try {
      if (editando) {
        const actualizado = await productosApi.update(editando.id, payload);
        dispatch({ type: 'ACTUALIZAR', payload: actualizado });
      } else {
        await productosApi.create(payload);
        await cargar();
      }
      cerrarModal();
    } catch (err) {
      setErrorForm((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (p: Producto) => {
    if (!confirm(`Eliminar producto "${p.nombre}"?`)) return;
    try {
      await productosApi.remove(p.id);
      dispatch({ type: 'ELIMINAR', payload: p.id });
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const toggleCategoria = (id: number) => {
    setCategoriasIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleIngrediente = (id: number) => {
    const exists = ingredientesSeleccionados.find((x) => x.ingrediente_id === id);
    if (exists) {
      setIngredientesSeleccionados((prev) => prev.filter((x) => x.ingrediente_id !== id));
    } else {
      setIngredientesSeleccionados((prev) => [
        ...prev,
        { ingrediente_id: id, es_alergeno: false },
      ]);
    }
  };

  const toggleAlergeno = (id: number, checked: boolean) => {
    setIngredientesSeleccionados((prev) =>
      prev.map((x) => (x.ingrediente_id === id ? { ...x, es_alergeno: checked } : x)),
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Productos</h1>
        <button className="btn-primary" onClick={abrirCrear}>
          Nuevo producto
        </button>
      </div>

      <div className="card mb-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-48">
          <label className="label">Buscar</label>
          <input
            className="input"
            placeholder="Nombre..."
            value={filtros.buscar}
            onChange={(e) => { setFiltros((f) => ({ ...f, buscar: e.target.value })); setOffset(0); }}
          />
        </div>
        <div className="w-56">
          <label className="label">Categoria</label>
          <select
            className="input"
            value={filtros.categoriaId}
            onChange={(e) => {
              setFiltros((f) => ({
                ...f,
                categoriaId: e.target.value === '' ? '' : Number(e.target.value),
              }));
              setOffset(0);
            }}
          >
            <option value="">— Todas —</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="w-40">
          <label className="label">Disponibilidad</label>
          <select
            className="input"
            value={filtros.disponible}
            onChange={(e) => {
              setFiltros((f) => ({
                ...f,
                disponible: e.target.value as 'todos' | 'si' | 'no',
              }));
              setOffset(0);
            }}
          >
            <option value="todos">Todos</option>
            <option value="si">Disponibles</option>
            <option value="no">No disponibles</option>
          </select>
        </div>
      </div>

      {state.error && (
        <ErrorBanner message={state.error} onRetry={cargar} />
      )}

      {state.cargando ? (
        <SkeletonCards count={6} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {state.productos.map((p) => (
            <div key={p.id} className="card-hover flex flex-col">
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-semibold">{p.nombre}</h2>
                {!p.disponible && (
                  <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                    NO DISPONIBLE
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-blue-600 mt-1">${p.precio.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Stock: {p.stock_cantidad}</p>
              <p className="text-sm text-gray-600 mt-2 min-h-10 line-clamp-2">
                {p.descripcion || 'Sin descripcion'}
              </p>
              <div className="flex flex-wrap gap-1 mt-3">
                {p.categorias.map((c) => (
                  <span
                    key={c.id}
                    className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded"
                  >
                    {c.nombre}
                  </span>
                ))}
                {p.ingredientes.map((i) => (
                  <span
                    key={i.id}
                    className={`text-xs px-2 py-0.5 rounded ${
                      i.es_alergeno
                        ? 'bg-red-100 text-red-800 font-semibold'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {i.nombre}
                    {i.es_alergeno && ' ⚠'}
                  </span>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                <button className="btn-ghost text-blue-600" onClick={() => abrirEditar(p)}>
                  Editar
                </button>
                <button className="btn-ghost text-red-600" onClick={() => handleEliminar(p)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {state.productos.length === 0 && (
            <div className="col-span-full card text-center text-gray-500">Sin resultados.</div>
          )}
        </div>
      )}

      <Pagination total={state.total} limit={LIMIT} offset={offset} onChange={setOffset} />

      <Modal
        isOpen={modalAbierto}
        onClose={cerrarModal}
        title={editando ? 'Editar producto' : 'Nuevo producto'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor={nombreId} className="label">
                Nombre
              </label>
              <input
                id={nombreId}
                ref={nombreRef}
                className="input"
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); setErrores((p) => ({ ...p, nombre: '' })); }}
              />
              {errores.nombre && <p className="field-error">{errores.nombre}</p>}
            </div>
            <div className="w-32">
              <label htmlFor={precioId} className="label">
                Precio
              </label>
              <input
                id={precioId}
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={precio}
                onChange={(e) => {
                  setPrecio(e.target.value === '' ? '' : Number(e.target.value));
                  setErrores((p) => ({ ...p, precio: '' }));
                }}
                onFocus={(e) => e.target.select()}
              />
              {errores.precio && <p className="field-error">{errores.precio}</p>}
            </div>
            <div className="w-28">
              <label htmlFor={stockId} className="label">
                Stock
              </label>
              <input
                id={stockId}
                type="number"
                min="0"
                className="input"
                value={stockCantidad}
                onChange={(e) =>
                  setStockCantidad(e.target.value === '' ? '' : Number(e.target.value))
                }
                onFocus={(e) => e.target.select()}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={disponible}
              onChange={(e) => setDisponible(e.target.checked)}
            />
            Disponible para la venta
          </label>

          <div>
            <label htmlFor={descripcionId} className="label">
              Descripcion
            </label>
            <textarea
              id={descripcionId}
              className="input"
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div>
              <p className="label">Categorias</p>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border rounded p-2">
                {categorias.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={categoriasIds.includes(c.id)}
                      onChange={() => toggleCategoria(c.id)}
                    />
                    {c.nombre}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="label">Ingredientes (marcar ⚠ si es alergeno)</p>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border rounded p-2">
                {ingredientes.map((ing) => {
                  const sel = ingredientesSeleccionados.find(
                    (x) => x.ingrediente_id === ing.id,
                  );
                  return (
                    <div key={ing.id} className="flex items-center justify-between text-sm">
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={sel !== undefined}
                          onChange={() => toggleIngrediente(ing.id)}
                        />
                        {ing.nombre}
                      </label>
                      {sel && (
                        <label className="flex items-center gap-1 text-xs text-red-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sel.es_alergeno}
                            onChange={(e) => toggleAlergeno(ing.id, e.target.checked)}
                          />
                          alergeno
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {errorForm && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-3">
              {errorForm}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" className="btn-secondary" onClick={cerrarModal}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
