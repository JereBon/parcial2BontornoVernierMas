import { useState, useEffect, useCallback, useRef, useId } from 'react';
import { categoriasApi } from '../api/categorias';
import type { CategoriaInput } from '../api/categorias';
import type { Categoria, CategoriaTreeNode } from '../models/types';
import { Modal } from '../components/Modal';
import { SkeletonRows } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';

function flattenForSelect(
  nodes: CategoriaTreeNode[],
  depth = 0,
): Array<{ id: number; label: string }> {
  const out: Array<{ id: number; label: string }> = [];
  for (const n of nodes) {
    out.push({ id: n.id, label: `${'-'.repeat(depth)} ${n.nombre}`.trim() });
    if (n.children?.length) out.push(...flattenForSelect(n.children, depth + 1));
  }
  return out;
}

function TreeNode({
  node,
  depth,
  onEdit,
  onDelete,
}: {
  node: CategoriaTreeNode;
  depth: number;
  onEdit: (c: Categoria) => void;
  onDelete: (c: Categoria) => void;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <li>
      <div
        className="flex items-center justify-between py-2 hover:bg-gray-50 rounded"
        style={{ paddingLeft: `${8 + depth * 20}px` }}
      >
        <div className="flex items-center gap-2 flex-1">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-5 h-5 inline-flex items-center justify-center text-gray-500 hover:text-gray-800 text-xs"
              aria-label={expanded ? 'Colapsar' : 'Expandir'}
            >
              {expanded ? '▼' : '▶'}
            </button>
          ) : (
            <span className="w-5 h-5 inline-block" />
          )}
          <span className="font-semibold">{node.nombre}</span>
          {node.descripcion && (
            <span className="ml-2 text-sm text-gray-500">{node.descripcion}</span>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost text-blue-600" onClick={() => onEdit(node)}>
            Editar
          </button>
          <button className="btn-ghost text-red-600" onClick={() => onDelete(node)}>
            Eliminar
          </button>
        </div>
      </div>
      {hasChildren && expanded && (
        <ul>
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function CategoriasPage() {
  const nombreId = useId();
  const descripcionId = useId();
  const parentId = useId();
  const nombreRef = useRef<HTMLInputElement>(null);

  const [tree, setTree] = useState<CategoriaTreeNode[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorPagina, setErrorPagina] = useState<string | null>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [parentIdVal, setParentIdVal] = useState<number | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const cargarArbol = useCallback(async () => {
    setCargando(true);
    try {
      const data = await categoriasApi.tree();
      setTree(data);
      setErrorPagina(null);
    } catch (err) {
      setErrorPagina((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarArbol();
  }, [cargarArbol]);

  useEffect(() => {
    if (modalAbierto) {
      setTimeout(() => nombreRef.current?.focus(), 50);
    }
  }, [modalAbierto]);

  const abrirCrear = () => {
    setEditando(null);
    setNombre('');
    setDescripcion('');
    setParentIdVal(null);
    setErrores({});
    setErrorForm(null);
    setModalAbierto(true);
  };

  const abrirEditar = (c: Categoria) => {
    setEditando(c);
    setNombre(c.nombre);
    setDescripcion(c.descripcion ?? '');
    setParentIdVal(c.parent_id ?? null);
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
    const payload: CategoriaInput = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      parent_id: parentIdVal,
    };
    try {
      if (editando) {
        await categoriasApi.update(editando.id, payload);
      } else {
        await categoriasApi.create(payload);
      }
      await cargarArbol();
      cerrarModal();
    } catch (err) {
      setErrorForm((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (c: Categoria) => {
    if (!confirm(`Eliminar categoria "${c.nombre}"?`)) return;
    try {
      await categoriasApi.remove(c.id);
      await cargarArbol();
      setErrorPagina(null);
    } catch (err) {
      setErrorPagina((err as Error).message);
    }
  };

  const parentOptions = flattenForSelect(tree);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Categorias</h1>
        <button className="btn-primary" onClick={abrirCrear}>
          Nueva categoria
        </button>
      </div>

      {errorPagina && (
        <div className="mb-4">
          <ErrorBanner message={errorPagina} onRetry={cargarArbol} />
        </div>
      )}

      <div className="card">
        {cargando ? (
          <SkeletonRows count={6} />
        ) : tree.length === 0 ? (
          <p className="text-gray-500">No hay categorias registradas.</p>
        ) : (
          <ul>
            {tree.map((n) => (
              <TreeNode
                key={n.id}
                node={n}
                depth={0}
                onEdit={abrirEditar}
                onDelete={handleEliminar}
              />
            ))}
          </ul>
        )}
      </div>

      <Modal
        isOpen={modalAbierto}
        onClose={cerrarModal}
        title={editando ? 'Editar categoria' : 'Nueva categoria'}
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
              onChange={(e) => { setNombre(e.target.value); setErrores((p) => ({ ...p, nombre: '' })); }}
            />
            {errores.nombre && <p className="field-error">{errores.nombre}</p>}
          </div>

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

          <div>
            <label htmlFor={parentId} className="label">
              Categoria padre (opcional)
            </label>
            <select
              id={parentId}
              className="input"
              value={parentIdVal === null ? '' : String(parentIdVal)}
              onChange={(e) =>
                setParentIdVal(e.target.value === '' ? null : Number(e.target.value))
              }
            >
              <option value="">— Sin padre (raiz) —</option>
              {parentOptions
                .filter((o) => o.id !== editando?.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
            </select>
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
