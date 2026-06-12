import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { direccionesApi, type DireccionInput } from '../api/direcciones';
import type { DireccionEntrega } from '../api/types';
import { Skeleton } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';

export default function DireccionesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DireccionEntrega | null>(null);
  const [adding, setAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ['direcciones'],
    queryFn: direccionesApi.list,
  });

  const createMut = useMutation({
    mutationFn: (input: DireccionInput) => direccionesApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['direcciones'] });
      setAdding(false);
    },
    onError: (err) => setErrorMsg((err as Error).message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<DireccionInput> }) =>
      direccionesApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['direcciones'] });
      setEditing(null);
    },
    onError: (err) => setErrorMsg((err as Error).message),
  });

  const setPrincipalMut = useMutation({
    mutationFn: (id: number) => direccionesApi.setPrincipal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['direcciones'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => direccionesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['direcciones'] }),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Mis direcciones</h1>
        {!adding && !editing && (
          <button className="btn-primary" onClick={() => { setErrorMsg(null); setAdding(true); }}>
            Nueva direccion
          </button>
        )}
      </div>

      {errorMsg && <div className="mb-4"><ErrorBanner message={errorMsg} /></div>}

      {(adding || editing) && (
        <div className="card mb-6">
          <DireccionForm
            initial={editing}
            onCancel={() => { setAdding(false); setEditing(null); }}
            onSubmit={(input) => {
              setErrorMsg(null);
              if (editing) updateMut.mutate({ id: editing.id, input });
              else createMut.mutate(input);
            }}
            isPending={createMut.isPending || updateMut.isPending}
          />
        </div>
      )}

      {listQ.isLoading ? <Skeleton className="h-24 w-full" /> :
       listQ.data?.length === 0 ? (
        <div className="card text-center text-gray-500">
          Todavia no tenes direcciones cargadas.
        </div>
       ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listQ.data?.map((d) => (
            <div key={d.id} className={`card ${d.es_principal ? 'border-orange-400 border-2' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    {d.alias ?? 'Sin alias'}
                    {d.es_principal && (
                      <span className="badge bg-orange-100 text-orange-800">Principal</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    {d.linea1}{d.linea2 ? `, ${d.linea2}` : ''}, {d.ciudad}
                  </p>
                  {d.provincia && <p className="text-xs text-gray-500">{d.provincia}</p>}
                  {d.codigo_postal && <p className="text-xs text-gray-500">CP {d.codigo_postal}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-1 mt-3 pt-3 border-t">
                {!d.es_principal && (
                  <button className="btn-ghost text-orange-600 text-sm"
                    onClick={() => setPrincipalMut.mutate(d.id)}>
                    Hacer principal
                  </button>
                )}
                <button className="btn-ghost text-blue-600 text-sm" onClick={() => setEditing(d)}>
                  Editar
                </button>
                <button className="btn-ghost text-red-600 text-sm"
                  onClick={() => {
                    if (confirm(`Eliminar direccion "${d.alias ?? d.linea1}"?`)) deleteMut.mutate(d.id);
                  }}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface FormProps {
  initial: DireccionEntrega | null;
  onSubmit: (input: DireccionInput) => void;
  onCancel: () => void;
  isPending: boolean;
}

function DireccionForm({ initial, onSubmit, onCancel, isPending }: FormProps) {
  const form = useForm({
    defaultValues: {
      alias: initial?.alias ?? '',
      linea1: initial?.linea1 ?? '',
      linea2: initial?.linea2 ?? '',
      ciudad: initial?.ciudad ?? '',
      provincia: initial?.provincia ?? '',
      codigo_postal: initial?.codigo_postal ?? '',
      es_principal: initial?.es_principal ?? false,
    },
    onSubmit: async ({ value }) => {
      onSubmit({
        alias: value.alias.trim() || null,
        linea1: value.linea1.trim(),
        linea2: value.linea2?.trim() || null,
        ciudad: value.ciudad.trim(),
        provincia: value.provincia?.trim() || null,
        codigo_postal: value.codigo_postal?.trim() || null,
        es_principal: value.es_principal,
      });
    },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }} className="flex flex-col gap-4">
      <h2 className="font-semibold">{initial ? 'Editar direccion' : 'Nueva direccion'}</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <form.Field name="alias">
          {(f) => (
            <div>
              <label className="label">Alias (opcional)</label>
              <input className="input" placeholder="Casa, Trabajo..."
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)} />
            </div>
          )}
        </form.Field>
        <form.Field name="linea1" validators={{
          onChange: ({ value }) => (!value || value.length < 2 ? 'Requerido' : undefined),
        }}>
          {(f) => (
            <div className="md:col-span-2">
              <label className="label">Calle y numero</label>
              <input className="input" placeholder="Av. Siempre Viva 742"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)} />
              {f.state.meta.errors[0] && (
                <p className="text-xs text-red-600 mt-0.5">{f.state.meta.errors[0]}</p>
              )}
            </div>
          )}
        </form.Field>
        <form.Field name="linea2">
          {(f) => (
            <div>
              <label className="label">Piso / Depto (opcional)</label>
              <input className="input" placeholder="2do B"
                value={f.state.value ?? ''}
                onChange={(e) => f.handleChange(e.target.value)} />
            </div>
          )}
        </form.Field>
        <form.Field name="ciudad" validators={{
          onChange: ({ value }) => (!value ? 'Requerido' : undefined),
        }}>
          {(f) => (
            <div>
              <label className="label">Ciudad</label>
              <input className="input" value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)} />
            </div>
          )}
        </form.Field>
        <form.Field name="provincia">
          {(f) => (
            <div>
              <label className="label">Provincia (opcional)</label>
              <input className="input" value={f.state.value ?? ''}
                onChange={(e) => f.handleChange(e.target.value)} />
            </div>
          )}
        </form.Field>
        <form.Field name="codigo_postal">
          {(f) => (
            <div>
              <label className="label">Codigo postal</label>
              <input className="input" value={f.state.value ?? ''}
                onChange={(e) => f.handleChange(e.target.value)} />
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="es_principal">
        {(f) => (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.state.value}
              onChange={(e) => f.handleChange(e.target.checked)} />
            Hacer principal
          </label>
        )}
      </form.Field>

      <div className="flex justify-end gap-2 pt-3 border-t">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <button type="submit" className="btn-primary" disabled={!canSubmit || isPending}>
              {isPending || isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
