import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { ingredientesApi, type IngredienteInput } from '../api/ingredientes';
import { lookupsApi } from '../api/lookups';
import type { Ingrediente } from '../api/types';
import { Modal } from '../components/Modal';
import { SkeletonRows } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';
import { useToast } from '../components/Toast';

const LIMIT = 20;

export default function IngredientesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ingrediente | null>(null);

  const listQ = useQuery({
    queryKey: ['ingredientes', 'list', { offset, limit: LIMIT, nombre: search || undefined }],
    queryFn: () => ingredientesApi.list({ skip: offset, limit: LIMIT, nombre: search || undefined }),
    placeholderData: (prev) => prev,
  });

  const unidadesQ = useQuery({
    queryKey: ['lookups', 'unidades-medida'],
    queryFn: lookupsApi.unidadesMedida,
    staleTime: 5 * 60_000,
  });

  const unidades = unidadesQ.data ?? [];

  const createMut = useMutation({
    mutationFn: (input: IngredienteInput) => ingredientesApi.create(input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ingredientes'] });
      toast.success(`Ingrediente "${data.nombre}" creado`);
      closeModal();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: number; input: IngredienteInput }) =>
      ingredientesApi.update(id, input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ingredientes'] });
      qc.invalidateQueries({ queryKey: ['productos'] });
      toast.success(`Ingrediente "${data.nombre}" actualizado`);
      closeModal();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => ingredientesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredientes'] });
      qc.invalidateQueries({ queryKey: ['productos'] });
      toast.success('Ingrediente eliminado');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const form = useForm({
    defaultValues: {
      nombre: '',
      descripcion: '',
      es_alergeno: false,
      stock_cantidad: 0 as number,
      unidad_medida_id: '' as number | '',
    },
    onSubmit: async ({ value }) => {
      if (value.unidad_medida_id === '') {
        toast.error('Seleccioná una unidad de medida');
        return;
      }
      const payload: IngredienteInput = {
        nombre: value.nombre.trim(),
        descripcion: value.descripcion.trim() || null,
        es_alergeno: value.es_alergeno,
        stock_cantidad: Math.max(0, Math.floor(value.stock_cantidad)),
        unidad_medida_id: Number(value.unidad_medida_id),
      };
      if (editing) await updateMut.mutateAsync({ id: editing.id, input: payload });
      else await createMut.mutateAsync(payload);
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset();
    setIsModalOpen(true);
  };

  const openEdit = (i: Ingrediente) => {
    setEditing(i);
    form.reset();
    form.setFieldValue('nombre', i.nombre);
    form.setFieldValue('descripcion', i.descripcion ?? '');
    form.setFieldValue('es_alergeno', i.es_alergeno);
    form.setFieldValue('stock_cantidad', i.stock_cantidad);
    form.setFieldValue('unidad_medida_id', i.unidad_medida?.id ?? '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    form.reset();
  };

  const handleDelete = (i: Ingrediente) => {
    if (confirm(`Eliminar ingrediente "${i.nombre}"?`)) deleteMut.mutate(i.id);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Ingredientes</h1>
        <button className="btn-primary" onClick={openCreate}>Nuevo ingrediente</button>
      </div>

      <div className="card mb-4">
        <label className="label">Buscar por nombre</label>
        <input
          className="input max-w-sm"
          placeholder="Mozarela, tomate..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
        />
      </div>

      {listQ.isError && (
        <ErrorBanner message={(listQ.error as Error).message} onRetry={() => listQ.refetch()} />
      )}

      <div className="card overflow-hidden p-0">
        {listQ.isLoading ? (
          <div className="p-4"><SkeletonRows count={5} /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head w-16">ID</th>
                <th className="table-head">Nombre</th>
                <th className="table-head w-36 text-center">Stock</th>
                <th className="table-head w-24 text-center">Alérgeno</th>
                <th className="table-head w-48 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listQ.data?.items.map((i) => (
                <tr key={i.id} className="border-t hover:bg-gray-50">
                  <td className="table-cell text-gray-500">#{i.id}</td>
                  <td className="table-cell font-medium">
                    {i.nombre}
                    {i.descripcion && (
                      <p className="text-xs text-gray-400">{i.descripcion}</p>
                    )}
                  </td>
                  <td className="table-cell text-center">
                    <span className={`font-semibold ${i.stock_cantidad === 0 ? 'text-red-600' : 'text-gray-800'}`}>
                      {i.stock_cantidad}
                      {i.unidad_medida && (
                        <span className="text-gray-500 font-normal ml-1">{i.unidad_medida.simbolo}</span>
                      )}
                    </span>
                  </td>
                  <td className="table-cell text-center">
                    {i.es_alergeno ? (
                      <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded">⚠ Sí</span>
                    ) : (
                      <span className="text-xs text-gray-400">No</span>
                    )}
                  </td>
                  <td className="table-cell text-right">
                    <button className="btn-ghost text-blue-600" onClick={() => openEdit(i)}>Editar</button>
                    <button className="btn-ghost text-red-600" onClick={() => handleDelete(i)}>Eliminar</button>
                  </td>
                </tr>
              ))}
              {listQ.data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-cell text-center text-gray-500 py-8">Sin resultados.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {listQ.data && (
        <Pagination total={listQ.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editing ? 'Editar ingrediente' : 'Nuevo ingrediente'}
      >
        <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }} className="flex flex-col gap-4">
          <form.Field
            name="nombre"
            validators={{ onChange: ({ value }) => (!value || value.trim().length < 2 ? 'Mínimo 2 caracteres' : undefined) }}
          >
            {(field) => (
              <div>
                <label htmlFor={field.name} className="label">Nombre *</label>
                <input
                  id={field.name}
                  className="input"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  autoFocus
                />
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                  <p className="field-error">{field.state.meta.errors.join(', ')}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="descripcion">
            {(field) => (
              <div>
                <label htmlFor={field.name} className="label">Descripción</label>
                <textarea
                  id={field.name}
                  className="input"
                  rows={2}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>

          <div className="flex gap-4 items-end">
            <form.Field name="stock_cantidad">
              {(field) => (
                <div className="w-36">
                  <label htmlFor={field.name} className="label">Stock inicial</label>
                  <input
                    id={field.name}
                    type="number"
                    min="0"
                    className="input"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Math.max(0, Number(e.target.value)))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              )}
            </form.Field>

            <form.Field
              name="unidad_medida_id"
              validators={{ onChange: ({ value }) => (value === '' ? 'Requerido' : undefined) }}
            >
              {(field) => (
                <div className="flex-1">
                  <label htmlFor={field.name} className="label">Unidad de medida *</label>
                  <select
                    id={field.name}
                    className="input"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value === '' ? '' : Number(e.target.value))}
                    onBlur={field.handleBlur}
                  >
                    <option value="">— Seleccionar —</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>{u.nombre} ({u.simbolo})</option>
                    ))}
                  </select>
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <p className="field-error">{field.state.meta.errors.join(', ')}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="es_alergeno">
              {(field) => (
                <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={field.state.value}
                    onChange={(e) => field.handleChange(e.target.checked)}
                  />
                  <span className="font-medium">Es alérgeno ⚠</span>
                </label>
              )}
            </form.Field>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
            <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
              {([canSubmit, isSubmitting]) => (
                <button type="submit" className="btn-primary" disabled={!canSubmit}>
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
