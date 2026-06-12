import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { categoriasApi, type CategoriaInput } from '../api/categorias';
import { uploadsApi } from '../api/uploads';
import type { Categoria, CategoriaTreeNode } from '../api/types';
import { Modal } from '../components/Modal';
import { SkeletonRows } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';

function flattenForSelect(nodes: CategoriaTreeNode[], depth = 0): Array<{ id: number; label: string }> {
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
          {node.imagen_url ? (
            <img src={node.imagen_url} alt={node.nombre} className="w-6 h-6 object-cover rounded flex-shrink-0" />
          ) : (
            <span className="w-6 h-6 inline-block flex-shrink-0" />
          )}
          <span className="font-semibold">{node.nombre}</span>
          {node.descripcion && <span className="ml-2 text-sm text-gray-500">{node.descripcion}</span>}
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost text-blue-600" onClick={() => onEdit(node)}>Editar</button>
          <button className="btn-ghost text-red-600" onClick={() => onDelete(node)}>Eliminar</button>
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

interface FormState {
  nombre: string;
  descripcion: string;
  parent_id: number | null;
}

export default function CategoriasPage() {
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Cloudinary image state
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [imagenPublicId, setImagenPublicId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const treeQ = useQuery({
    queryKey: ['categorias', 'tree'],
    queryFn: categoriasApi.tree,
  });

  const createMut = useMutation({
    mutationFn: (input: CategoriaInput) => categoriasApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias'] });
      closeModal();
    },
    onError: (err) => setErrorMsg((err as Error).message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: number; input: CategoriaInput }) =>
      categoriasApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias'] });
      closeModal();
    },
    onError: (err) => setErrorMsg((err as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => categoriasApi.remove(id),
    onSuccess: () => {
      setPageError(null);
      qc.invalidateQueries({ queryKey: ['categorias'] });
    },
    onError: (err) => setPageError((err as Error).message),
  });

  const form = useForm({
    defaultValues: { nombre: '', descripcion: '', parent_id: null } as FormState,
    onSubmit: async ({ value }) => {
      const payload: CategoriaInput = {
        nombre: value.nombre.trim(),
        descripcion: value.descripcion.trim() || null,
        parent_id: value.parent_id,
        imagen_url: imagenUrl,
      };
      if (editing) await updateMut.mutateAsync({ id: editing.id, input: payload });
      else await createMut.mutateAsync(payload);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setErrorMsg(null);
    setImagenUrl(null);
    setImagenPublicId(null);
    setUploadError(null);
    form.reset();
    setIsModalOpen(true);
  };

  const openEdit = (c: Categoria) => {
    setEditing(c);
    setErrorMsg(null);
    setUploadError(null);
    setImagenUrl(c.imagen_url ?? null);
    // For pre-existing images from editing, we store URL as placeholder public_id
    setImagenPublicId(c.imagen_url ? `__existing__${c.imagen_url}` : null);
    form.reset();
    form.setFieldValue('nombre', c.nombre);
    form.setFieldValue('descripcion', c.descripcion ?? '');
    form.setFieldValue('parent_id', c.parent_id ?? null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setImagenUrl(null);
    setImagenPublicId(null);
    setUploadError(null);
    form.reset();
  };

  const handleDelete = (c: Categoria) => {
    setPageError(null);
    if (confirm(`Eliminar categoria "${c.nombre}"?`)) deleteMut.mutate(c.id);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await uploadsApi.uploadImagen(file, 'categorias');
      setImagenUrl(result.secure_url);
      setImagenPublicId(result.public_id);
    } catch (err) {
      setUploadError((err as Error).message || 'Error al subir imagen');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (imagenPublicId && !imagenPublicId.startsWith('__existing__')) {
      try {
        await uploadsApi.deleteImagen(imagenPublicId);
      } catch {
        // Non-critical
      }
    }
    setImagenUrl(null);
    setImagenPublicId(null);
  };

  const parentOptions = treeQ.data ? flattenForSelect(treeQ.data) : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Categorias</h1>
        <button className="btn-primary" onClick={openCreate}>Nueva categoria</button>
      </div>

      {treeQ.isError && (
        <ErrorBanner message={(treeQ.error as Error).message} onRetry={() => treeQ.refetch()} />
      )}
      {pageError && (
        <div className="mb-4">
          <ErrorBanner message={pageError} />
        </div>
      )}

      <div className="card">
        {treeQ.isLoading ? (
          <SkeletonRows count={6} />
        ) : !treeQ.data || treeQ.data.length === 0 ? (
          <p className="text-gray-500">No hay categorias registradas.</p>
        ) : (
          <ul>
            {treeQ.data.map((n) => (
              <TreeNode key={n.id} node={n} depth={0} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </ul>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editing ? 'Editar categoria' : 'Nueva categoria'}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <form.Field
            name="nombre"
            validators={{
              onChange: ({ value }) => (!value || value.trim().length < 2 ? 'Minimo 2 caracteres' : undefined),
            }}
          >
            {(field) => (
              <div>
                <label htmlFor={field.name} className="label">Nombre</label>
                <input
                  id={field.name}
                  className="input"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
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
                <label htmlFor={field.name} className="label">Descripcion</label>
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

          <form.Field name="parent_id">
            {(field) => (
              <div>
                <label htmlFor={field.name} className="label">Categoria padre (opcional)</label>
                <select
                  id={field.name}
                  className="input"
                  value={field.state.value === null ? '' : String(field.state.value)}
                  onChange={(e) => field.handleChange(e.target.value === '' ? null : Number(e.target.value))}
                >
                  <option value="">— Sin padre (raiz) —</option>
                  {parentOptions
                    .filter((o) => o.id !== editing?.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                </select>
              </div>
            )}
          </form.Field>

          {/* ── Imagen Cloudinary ── */}
          <div className="border rounded-lg p-3 bg-gray-50">
            <p className="label mb-2">Imagen</p>

            {imagenUrl ? (
              <div className="relative inline-block mb-3">
                <img
                  src={imagenUrl}
                  alt="Preview categoria"
                  className="w-32 h-32 object-cover rounded border"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center"
                  title="Quitar imagen"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="w-32 h-32 bg-gray-100 rounded border flex items-center justify-center text-gray-300 text-xs mb-3">
                Sin imagen
              </div>
            )}

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="btn-secondary text-sm"
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Subiendo...
                  </span>
                ) : imagenUrl ? (
                  'Cambiar imagen'
                ) : (
                  'Subir imagen'
                )}
              </button>
              <span className="text-xs text-gray-400">JPG, PNG, WEBP</span>
            </div>

            {uploadError && (
              <p className="text-xs text-red-600 mt-1">{uploadError}</p>
            )}
          </div>

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
