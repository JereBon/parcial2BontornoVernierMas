import { useState, useEffect, useCallback, useRef, useId } from 'react';
import { ingredientesApi } from '../api/ingredientes';
import type { Ingrediente } from '../models/types';
import { Modal } from '../components/Modal';
import { SkeletonRows } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';
import {
  ingredientesReducer,
  ingredientesEstadoInicial,
} from '../reducers/ingredientesReducer';
import { useReducer } from 'react';

const LIMIT = 20;

export default function IngredientesPage() {
  const [state, dispatch] = useReducer(ingredientesReducer, ingredientesEstadoInicial);
  const [offset, setOffset] = useState(0);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Ingrediente | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const nombreId = useId();
  const nombreRef = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});

  const cargar = useCallback(async () => {
    dispatch({ type: 'CARGAR_INICIO' });
    try {
      const data = await ingredientesApi.list({ skip: offset, limit: LIMIT });
      dispatch({ type: 'CARGAR_EXITO', payload: data });
    } catch (err) {
      dispatch({ type: 'CARGAR_ERROR', payload: (err as Error).message });
    }
  }, [offset]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (modalAbierto) {
      setTimeout(() => nombreRef.current?.focus(), 50);
    }
  }, [modalAbierto]);

  const abrirCrear = () => {
    setEditando(null);
    setNombre('');
    setErrores({});
    setErrorForm(null);
    setModalAbierto(true);
  };

  const abrirEditar = (i: Ingrediente) => {
    setEditando(i);
    setNombre(i.nombre);
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
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    setErrorForm(null);
    setGuardando(true);
    try {
      if (editando) {
        const actualizado = await ingredientesApi.update(editando.id, { nombre: nombre.trim() });
        dispatch({ type: 'ACTUALIZAR', payload: actualizado });
      } else {
        const nuevo = await ingredientesApi.create({ nombre: nombre.trim() });
        dispatch({ type: 'AGREGAR', payload: nuevo });
      }
      cerrarModal();
    } catch (err) {
      setErrorForm((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (i: Ingrediente) => {
    if (!confirm(`Eliminar ingrediente "${i.nombre}"?`)) return;
    try {
      await ingredientesApi.remove(i.id);
      dispatch({ type: 'ELIMINAR', payload: i.id });
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Ingredientes</h1>
        <button className="btn-primary" onClick={abrirCrear}>
          Nuevo ingrediente
        </button>
      </div>

      {state.error && (
        <ErrorBanner message={state.error} onRetry={cargar} />
      )}

      <div className="card overflow-hidden p-0">
        {state.cargando ? (
          <div className="p-4">
            <SkeletonRows count={5} />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head w-16">ID</th>
                <th className="table-head">Nombre</th>
                <th className="table-head w-48 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {state.ingredientes.map((i) => (
                <tr key={i.id} className="border-t hover:bg-gray-50">
                  <td className="table-cell text-gray-500">#{i.id}</td>
                  <td className="table-cell font-medium">{i.nombre}</td>
                  <td className="table-cell text-right">
                    <button className="btn-ghost text-blue-600" onClick={() => abrirEditar(i)}>
                      Editar
                    </button>
                    <button
                      className="btn-ghost text-red-600"
                      onClick={() => handleEliminar(i)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {state.ingredientes.length === 0 && (
                <tr>
                  <td colSpan={3} className="table-cell text-center text-gray-500 py-8">
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        total={state.total}
        limit={LIMIT}
        offset={offset}
        onChange={(o) => setOffset(o)}
      />

      <Modal
        isOpen={modalAbierto}
        onClose={cerrarModal}
        title={editando ? 'Editar ingrediente' : 'Nuevo ingrediente'}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor={nombreId} className="label">
              Nombre
            </label>
            <input
              id={nombreId}
              ref={nombreRef}
              className="input"
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); setErrores({}); }}
            />
            {errores.nombre && <p className="field-error">{errores.nombre}</p>}
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
