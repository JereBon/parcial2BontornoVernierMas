import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { productosApi, type ProductoInput, type ProductoIngredienteInput } from '../api/productos';
import { categoriasApi } from '../api/categorias';
import { ingredientesApi } from '../api/ingredientes';
import { lookupsApi } from '../api/lookups';
import { uploadsApi } from '../api/uploads';
import type { CategoriaTreeNode, Ingrediente, Producto, UnidadMedida } from '../api/types';
import { Modal } from '../components/Modal';
import { SkeletonCards } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';

const LIMIT = 12;

function collectLeaves(nodes: CategoriaTreeNode[]): CategoriaTreeNode[] {
  const leaves: CategoriaTreeNode[] = [];
  for (const n of nodes) {
    if (!n.children || n.children.length === 0) {
      leaves.push(n);
    } else {
      leaves.push(...collectLeaves(n.children));
    }
  }
  return leaves;
}

interface FormState {
  nombre: string;
  precio_base: number | '';
  descripcion: string;
  disponible: boolean;
  categorias_ids: number[];
  ingredientes: ProductoIngredienteInput[];
}

interface UploadedImage {
  secure_url: string;
  public_id: string;
}

export default function ProductosPage() {
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [filterCategoria, setFilterCategoria] = useState<number | ''>('');
  const [filterDisponible, setFilterDisponible] = useState<'todos' | 'si' | 'no'>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ingSearch, setIngSearch] = useState('');

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filters = {
    page: Math.floor(offset / LIMIT) + 1,
    size: LIMIT,
    nombre: search || undefined,
    categoria_id: filterCategoria === '' ? undefined : Number(filterCategoria),
    disponible: filterDisponible === 'todos' ? undefined : filterDisponible === 'si',
  };

  const listQ = useQuery({
    queryKey: ['productos', 'list', filters],
    queryFn: () => productosApi.list(filters),
  });

  const treeQ = useQuery({
    queryKey: ['categorias', 'tree'],
    queryFn: categoriasApi.tree,
  });

  const ingredientesQ = useQuery({
    queryKey: ['ingredientes', 'list', { size: 200 }],
    queryFn: () => ingredientesApi.list({ size: 200 }),
  });

  const unidadesQ = useQuery({
    queryKey: ['lookups', 'unidades-medida'],
    queryFn: lookupsApi.unidadesMedida,
  });

  const createMut = useMutation({
    mutationFn: (input: ProductoInput) => productosApi.create(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['productos'] }); closeModal(); },
    onError: (err) => setErrorMsg((err as Error).message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: number; input: ProductoInput }) =>
      productosApi.update(id, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['productos'] }); closeModal(); },
    onError: (err) => setErrorMsg((err as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => productosApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productos'] }),
  });

  const disponibilidadMut = useMutation({
    mutationFn: ({ id, disponible }: { id: number; disponible: boolean }) =>
      productosApi.patchDisponibilidad(id, { disponible }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productos'] }),
  });

  const form = useForm({
    defaultValues: {
      nombre: '',
      precio_base: '' as number | '',
      descripcion: '',
      disponible: true,
      categorias_ids: [],
      ingredientes: [],
    } as FormState,
    onSubmit: async ({ value }) => {
      if (value.ingredientes.length === 0) {
        setErrorMsg('Debe agregar al menos un ingrediente.');
        return;
      }
      const payload: ProductoInput = {
        nombre: value.nombre.trim(),
        precio_base: Number(value.precio_base),
        descripcion: value.descripcion.trim() || null,
        disponible: value.disponible,
        categorias_ids: value.categorias_ids,
        ingredientes: value.ingredientes,
        imagenes_url: uploadedImages.length > 0
          ? uploadedImages.map((img) => img.secure_url)
          : null,
      };
      if (editing) await updateMut.mutateAsync({ id: editing.id, input: payload });
      else await createMut.mutateAsync(payload);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setErrorMsg(null);
    setUploadedImages([]);
    setUploadError(null);
    setIngSearch('');
    form.reset();
    setIsModalOpen(true);
  };

  const openEdit = (p: Producto) => {
    setEditing(p);
    setErrorMsg(null);
    setUploadError(null);
    setIngSearch('');
    setUploadedImages(
      (p.imagenes_url ?? []).map((url) => ({ secure_url: url, public_id: url })),
    );
    form.reset();
    form.setFieldValue('nombre', p.nombre);
    form.setFieldValue('precio_base', p.precio_base);
    form.setFieldValue('descripcion', p.descripcion ?? '');
    form.setFieldValue('disponible', p.disponible);
    form.setFieldValue('categorias_ids', p.categorias.map((c) => c.id));
    form.setFieldValue('ingredientes', p.producto_ingredientes.map((pi) => ({
      ingrediente_id: pi.ingrediente_id,
      cantidad: pi.cantidad,
      unidad_medida_id: pi.unidad_medida_id,
      es_removible: pi.es_removible,
    })));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setUploadedImages([]);
    setUploadError(null);
    setIngSearch('');
    form.reset();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsUploading(true);
    setUploadError(null);
    try {
      const results = await Promise.all(
        files.map((file) => uploadsApi.uploadImagen(file, 'productos')),
      );
      setUploadedImages((prev) => [
        ...prev,
        ...results.map((r) => ({ secure_url: r.secure_url, public_id: r.public_id })),
      ]);
    } catch (err) {
      setUploadError((err as Error).message || 'Error al subir imagen');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (img: UploadedImage, index: number) => {
    const isCloudinaryId = !img.public_id.startsWith('http');
    if (isCloudinaryId) {
      try { await uploadsApi.deleteImagen(img.public_id); } catch { /* non-critical */ }
    }
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const leafCategorias = treeQ.data ? collectLeaves(treeQ.data) : [];
  const unidades: UnidadMedida[] = unidadesQ.data ?? [];
  const filteredIngredientes = (ingredientesQ.data?.items ?? []).filter((i: Ingrediente) =>
    i.nombre.toLowerCase().includes(ingSearch.toLowerCase()),
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Productos</h1>
        <button className="btn-primary" onClick={openCreate}>Nuevo producto</button>
      </div>

      {/* Filtros */}
      <div className="card mb-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-48">
          <label className="label">Buscar</label>
          <input className="input" placeholder="Nombre..." value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }} />
        </div>
        <div className="w-56">
          <label className="label">Categoria</label>
          <select className="input" value={filterCategoria}
            onChange={(e) => { setFilterCategoria(e.target.value === '' ? '' : Number(e.target.value)); setOffset(0); }}>
            <option value="">— Todas —</option>
            {leafCategorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div className="w-40">
          <label className="label">Disponibilidad</label>
          <select className="input" value={filterDisponible}
            onChange={(e) => { setFilterDisponible(e.target.value as 'todos' | 'si' | 'no'); setOffset(0); }}>
            <option value="todos">Todos</option>
            <option value="si">Disponibles</option>
            <option value="no">No disponibles</option>
          </select>
        </div>
      </div>

      {listQ.isError && (
        <ErrorBanner message={(listQ.error as Error).message} onRetry={() => listQ.refetch()} />
      )}

      {listQ.isLoading ? (
        <SkeletonCards count={6} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listQ.data?.items.map((p) => (
            <div key={p.id} className="card-hover flex flex-col">
              {p.imagenes_url && p.imagenes_url.length > 0 ? (
                <img src={p.imagenes_url[0]} alt={p.nombre}
                  className="w-full h-36 object-cover rounded-md mb-3" />
              ) : (
                <div className="w-full h-36 bg-gray-100 rounded-md mb-3 flex items-center justify-center text-gray-300 text-xs">
                  Sin imagen
                </div>
              )}
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-semibold">{p.nombre}</h2>
                <button
                  onClick={() => disponibilidadMut.mutate({ id: p.id, disponible: !p.disponible })}
                  className={`text-xs font-bold px-2 py-0.5 rounded cursor-pointer border-0 ${
                    p.disponible
                      ? 'text-green-700 bg-green-100 hover:bg-green-200'
                      : 'text-red-700 bg-red-100 hover:bg-red-200'
                  }`}
                  title="Click para cambiar disponibilidad"
                >
                  {p.disponible ? 'Disponible' : 'No disponible'}
                </button>
              </div>
              <p className="text-2xl font-bold text-blue-600 mt-1">${p.precio_base.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Stock: {p.stock_disponible}</p>
              <p className="text-sm text-gray-600 mt-2 min-h-10 line-clamp-2">
                {p.descripcion || 'Sin descripcion'}
              </p>
              <div className="flex flex-wrap gap-1 mt-3">
                {p.categorias.map((c) => (
                  <span key={c.id} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                    {c.nombre}
                  </span>
                ))}
                {p.producto_ingredientes.map((pi) => (
                  <span key={pi.ingrediente_id} className={`text-xs px-2 py-0.5 rounded ${
                    pi.ingrediente?.es_alergeno ? 'bg-red-100 text-red-800 font-semibold' : 'bg-green-100 text-green-800'
                  }`}>
                    {pi.ingrediente?.nombre}{pi.ingrediente?.es_alergeno && ' ⚠'}
                    {pi.es_removible && ' (removible)'}
                  </span>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                <button className="btn-ghost text-blue-600" onClick={() => openEdit(p)}>Editar</button>
                <button className="btn-ghost text-red-600"
                  onClick={() => { if (confirm(`Eliminar "${p.nombre}"?`)) deleteMut.mutate(p.id); }}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {listQ.data?.items.length === 0 && (
            <div className="col-span-full card text-center text-gray-500">Sin resultados.</div>
          )}
        </div>
      )}

      {listQ.data && (
        <Pagination total={listQ.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal}
        title={editing ? 'Editar producto' : 'Nuevo producto'} size="lg">
        <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }} className="flex flex-col gap-4">

          {/* Nombre + Precio */}
          <div className="flex gap-4">
            <form.Field name="nombre" validators={{
              onChange: ({ value }) => (!value || value.trim().length < 2 ? 'Minimo 2 caracteres' : undefined),
            }}>
              {(field) => (
                <div className="flex-1">
                  <label className="label">Nombre</label>
                  <input className="input" value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} />
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <p className="field-error">{field.state.meta.errors.join(', ')}</p>
                  )}
                </div>
              )}
            </form.Field>
            <form.Field name="precio_base" validators={{
              onChange: ({ value }) => (value === '' || Number(value) <= 0 ? 'Debe ser > 0' : undefined),
            }}>
              {(field) => (
                <div className="w-36">
                  <label className="label">Precio</label>
                  <input type="number" step="0.01" min="0.01" className="input"
                    value={field.state.value === '' ? '' : field.state.value}
                    onChange={(e) => field.handleChange(e.target.value === '' ? '' : Number(e.target.value))}
                    onBlur={field.handleBlur} onFocus={(e) => e.target.select()} />
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <p className="field-error">{field.state.meta.errors.join(', ')}</p>
                  )}
                </div>
              )}
            </form.Field>
          </div>

          {/* Disponible */}
          <form.Field name="disponible">
            {(field) => (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={field.state.value}
                  onChange={(e) => field.handleChange(e.target.checked)} />
                Disponible para la venta
              </label>
            )}
          </form.Field>

          {/* Descripcion */}
          <form.Field name="descripcion">
            {(field) => (
              <div>
                <label className="label">Descripcion</label>
                <textarea className="input" rows={2} value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)} />
              </div>
            )}
          </form.Field>

          {/* Imagenes */}
          <div className="border rounded-lg p-3 bg-gray-50">
            <p className="label mb-2">Imagenes</p>
            {uploadedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {uploadedImages.map((img, idx) => (
                  <div key={idx} className="relative group w-20 h-20">
                    <img src={img.secure_url} alt={`imagen ${idx + 1}`}
                      className="w-full h-full object-cover rounded border" />
                    <button type="button" onClick={() => handleDeleteImage(img, idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3">
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                multiple className="hidden" onChange={handleFileChange} disabled={isUploading} />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                disabled={isUploading} className="btn-secondary text-sm">
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Subiendo...
                  </span>
                ) : '+ Agregar imagen'}
              </button>
              <span className="text-xs text-gray-400">JPG, PNG, WEBP · máx 5MB</span>
            </div>
            {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
          </div>

          {/* Categorias - solo hojas */}
          <form.Field name="categorias_ids">
            {(field) => (
              <div>
                <p className="label">Categorias</p>
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto border rounded p-2">
                  {leafCategorias.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      No hay categorias hoja disponibles. Crea subcategorias primero.
                    </p>
                  ) : (
                    leafCategorias.map((c) => {
                      const checked = field.state.value.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={checked}
                            onChange={() => field.handleChange(
                              checked ? field.state.value.filter((x) => x !== c.id)
                                      : [...field.state.value, c.id],
                            )} />
                          {c.nombre}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </form.Field>

          {/* Ingredientes con buscador */}
          <form.Field name="ingredientes">
            {(field) => {
              const selected = field.state.value;
              return (
                <div>
                  <p className="label">
                    Ingredientes <span className="text-red-500 text-xs">(requerido al menos 1)</span>
                  </p>

                  {/* Lista de ingredientes ya agregados */}
                  {selected.length > 0 && (
                    <div className="flex flex-col gap-2 mb-2 border rounded p-2 bg-white max-h-48 overflow-y-auto">
                      {selected.map((ing, idx) => {
                        const meta = ingredientesQ.data?.items.find(
                          (i: Ingrediente) => i.id === ing.ingrediente_id,
                        );
                        return (
                          <div key={ing.ingrediente_id}
                            className="grid items-center gap-2 text-sm"
                            style={{ gridTemplateColumns: '1fr 80px 90px auto auto' }}>
                            <span className="font-medium truncate">
                              {meta?.nombre ?? `#${ing.ingrediente_id}`}
                              {meta?.es_alergeno && (
                                <span className="ml-1 text-xs text-red-600">⚠</span>
                              )}
                            </span>
                            <input
                              type="number" min="0.001" step="0.001" className="input py-1 text-sm"
                              placeholder="Cant."
                              value={ing.cantidad || ''}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => field.handleChange(
                                selected.map((x, i) =>
                                  i === idx ? { ...x, cantidad: Number(e.target.value) } : x,
                                ),
                              )}
                            />
                            <select className="input py-1 text-sm" value={ing.unidad_medida_id || ''}
                              onChange={(e) => field.handleChange(
                                selected.map((x, i) =>
                                  i === idx ? { ...x, unidad_medida_id: Number(e.target.value) } : x,
                                ),
                              )}>
                              <option value="">Unidad</option>
                              {unidades.map((u: UnidadMedida) => (
                                <option key={u.id} value={u.id}>{u.simbolo}</option>
                              ))}
                            </select>
                            <label className="flex items-center gap-1 text-xs cursor-pointer whitespace-nowrap">
                              <input type="checkbox" checked={ing.es_removible}
                                onChange={(e) => field.handleChange(
                                  selected.map((x, i) =>
                                    i === idx ? { ...x, es_removible: e.target.checked } : x,
                                  ),
                                )} />
                              Removible
                            </label>
                            <button type="button"
                              className="text-red-500 hover:text-red-700 text-xs px-1 font-bold"
                              onClick={() => field.handleChange(selected.filter((_, i) => i !== idx))}>
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Buscador para agregar */}
                  <div className="border rounded p-2 bg-gray-50">
                    <input
                      className="input mb-2 text-sm"
                      placeholder="Buscar ingrediente para agregar..."
                      value={ingSearch}
                      onChange={(e) => setIngSearch(e.target.value)}
                    />
                    <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto">
                      {filteredIngredientes
                        .filter((i: Ingrediente) =>
                          !selected.some((s) => s.ingrediente_id === i.id),
                        )
                        .map((ing: Ingrediente) => (
                          <button
                            key={ing.id}
                            type="button"
                            className="flex items-center justify-between text-sm px-2 py-1.5 rounded hover:bg-white text-left transition-colors"
                            onClick={() => {
                              field.handleChange([
                                ...selected,
                                {
                                  ingrediente_id: ing.id,
                                  cantidad: 1,
                                  unidad_medida_id: ing.unidad_medida?.id ?? 0,
                                  es_removible: false,
                                },
                              ]);
                              setIngSearch('');
                            }}
                          >
                            <span>+ {ing.nombre}</span>
                            {ing.es_alergeno && (
                              <span className="text-xs text-red-600 font-semibold">⚠ alergeno</span>
                            )}
                          </button>
                        ))}
                      {filteredIngredientes.filter(
                        (i: Ingrediente) => !selected.some((s) => s.ingrediente_id === i.id),
                      ).length === 0 && (
                        <p className="text-xs text-gray-400 px-2 py-1">
                          {ingSearch
                            ? 'Sin resultados para esa búsqueda.'
                            : 'Todos los ingredientes ya fueron agregados.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            }}
          </form.Field>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-3">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
            <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
              {([canSubmit, isSubmitting]) => (
                <button type="submit" className="btn-primary" disabled={!canSubmit || isUploading}>
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
                </button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </Modal>
    </div>
  );
}
