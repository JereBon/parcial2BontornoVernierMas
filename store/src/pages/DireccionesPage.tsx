import { useId, useRef, useState, useEffect, useCallback } from 'react';
import { direccionesApi, type DireccionInput } from '../api/direcciones';
import type { DireccionEntrega } from '../models/types';
import { Skeleton } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';

export default function DireccionesPage() {
  const [direcciones, setDirecciones] = useState<DireccionEntrega[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editing, setEditing] = useState<DireccionEntrega | null>(null);
  const [adding, setAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const data = await direccionesApi.list();
      setDirecciones(data);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleSubmit = async (input: DireccionInput) => {
    setErrorMsg(null);
    setGuardando(true);
    try {
      if (editing) {
        await direccionesApi.update(editing.id, input);
        setEditing(null);
      } else {
        await direccionesApi.create(input);
        setAdding(false);
      }
      await cargar();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const handleSetPrincipal = async (id: number) => {
    try {
      await direccionesApi.setPrincipal(id);
      await cargar();
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleEliminar = async (d: DireccionEntrega) => {
    if (!confirm(`Eliminar direccion "${d.alias}"?`)) return;
    try {
      await direccionesApi.remove(d.id);
      await cargar();
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

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
            onSubmit={handleSubmit}
            isPending={guardando}
          />
        </div>
      )}

      {cargando ? (
        <Skeleton className="h-24 w-full" />
      ) : direcciones.length === 0 ? (
        <div className="card text-center text-gray-500">
          Todavia no tenes direcciones cargadas.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {direcciones.map((d) => (
            <div key={d.id} className={`card ${d.principal ? 'border-orange-400 border-2' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    {d.alias}
                    {d.principal && (
                      <span className="badge bg-orange-100 text-orange-800">Principal</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">{d.calle} {d.numero}, {d.ciudad}</p>
                  {d.codigo_postal && <p className="text-xs text-gray-500">CP {d.codigo_postal}</p>}
                  {d.detalles && <p className="text-xs text-gray-500">{d.detalles}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-1 mt-3 pt-3 border-t">
                {!d.principal && (
                  <button
                    className="btn-ghost text-orange-600 text-sm"
                    onClick={() => handleSetPrincipal(d.id)}
                  >
                    Hacer principal
                  </button>
                )}
                <button
                  className="btn-ghost text-blue-600 text-sm"
                  onClick={() => { setErrorMsg(null); setEditing(d); setAdding(false); }}
                >
                  Editar
                </button>
                <button
                  className="btn-ghost text-red-600 text-sm"
                  onClick={() => handleEliminar(d)}
                >
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
  const aliasId = useId();
  const calleId = useId();
  const numeroId = useId();
  const ciudadId = useId();
  const cpId = useId();
  const detallesId = useId();
  const aliasRef = useRef<HTMLInputElement>(null);

  const [alias, setAlias] = useState(initial?.alias ?? '');
  const [calle, setCalle] = useState(initial?.calle ?? '');
  const [numero, setNumero] = useState(initial?.numero ?? '');
  const [ciudad, setCiudad] = useState(initial?.ciudad ?? '');
  const [codigoPostal, setCodigoPostal] = useState(initial?.codigo_postal ?? '');
  const [detalles, setDetalles] = useState(initial?.detalles ?? '');
  const [principal, setPrincipal] = useState(initial?.principal ?? false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  useEffect(() => {
    setTimeout(() => aliasRef.current?.focus(), 50);
  }, []);

  const validar = () => {
    const e: Record<string, string> = {};
    if (!alias || alias.length < 2) e.alias = 'Requerido';
    if (!calle || calle.length < 2) e.calle = 'Requerido';
    if (!numero) e.numero = 'Requerido';
    if (!ciudad) e.ciudad = 'Requerido';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    onSubmit({
      alias: alias.trim(),
      calle: calle.trim(),
      numero: numero.trim(),
      ciudad: ciudad.trim(),
      codigo_postal: codigoPostal.trim() || null,
      detalles: detalles.trim() || null,
      principal,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="font-semibold">{initial ? 'Editar direccion' : 'Nueva direccion'}</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label htmlFor={aliasId} className="label">Alias</label>
          <input
            id={aliasId}
            ref={aliasRef}
            className="input"
            placeholder="Casa, Trabajo..."
            value={alias}
            onChange={(e) => { setAlias(e.target.value); setErrores((p) => ({ ...p, alias: '' })); }}
          />
          {errores.alias && <p className="field-error">{errores.alias}</p>}
        </div>
        <div className="md:col-span-2">
          <label htmlFor={calleId} className="label">Calle</label>
          <input
            id={calleId}
            className="input"
            value={calle}
            onChange={(e) => { setCalle(e.target.value); setErrores((p) => ({ ...p, calle: '' })); }}
          />
          {errores.calle && <p className="field-error">{errores.calle}</p>}
        </div>
        <div>
          <label htmlFor={numeroId} className="label">Numero</label>
          <input
            id={numeroId}
            className="input"
            value={numero}
            onChange={(e) => { setNumero(e.target.value); setErrores((p) => ({ ...p, numero: '' })); }}
          />
          {errores.numero && <p className="field-error">{errores.numero}</p>}
        </div>
        <div>
          <label htmlFor={ciudadId} className="label">Ciudad</label>
          <input
            id={ciudadId}
            className="input"
            value={ciudad}
            onChange={(e) => { setCiudad(e.target.value); setErrores((p) => ({ ...p, ciudad: '' })); }}
          />
          {errores.ciudad && <p className="field-error">{errores.ciudad}</p>}
        </div>
        <div>
          <label htmlFor={cpId} className="label">Codigo postal</label>
          <input
            id={cpId}
            className="input"
            value={codigoPostal ?? ''}
            onChange={(e) => setCodigoPostal(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor={detallesId} className="label">Detalles (depto, referencia, etc.)</label>
        <input
          id={detallesId}
          className="input"
          value={detalles ?? ''}
          onChange={(e) => setDetalles(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={principal}
          onChange={(e) => setPrincipal(e.target.checked)}
        />
        Hacer principal
      </label>

      <div className="flex justify-end gap-2 pt-3 border-t">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
