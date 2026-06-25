import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, type UsuarioAdminCreateInput } from '../api/admin';
import type { UsuarioAdmin } from '../api/types';
import { Modal } from '../components/Modal';
import { SkeletonRows } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';

const LIMIT = 20;
const ROLES = ['ADMIN', 'STOCK', 'PEDIDOS', 'CLIENT'] as const;

export default function UsuariosPage() {
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [rolFilter, setRolFilter] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [editingRoles, setEditingRoles] = useState<UsuarioAdmin | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const page = Math.floor(offset / LIMIT) + 1;
  const filters = {
    page,
    size: LIMIT,
    rol: rolFilter || undefined,
    busqueda: busqueda.trim() || undefined,
  };

  const listQ = useQuery({
    queryKey: ['admin', 'usuarios', filters],
    queryFn: () => adminApi.listUsuarios(filters),
    placeholderData: (prev) => prev,
  });

  const rolesMut = useMutation({
    mutationFn: ({ id, roles }: { id: number; roles: string[] }) =>
      adminApi.replaceRoles(id, roles),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] });
      setEditingRoles(null);
    },
    onError: (err) => setModalError((err as Error).message),
  });

  const createMut = useMutation({
    mutationFn: (payload: UsuarioAdminCreateInput) => adminApi.createUsuario(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] });
      setShowCreate(false);
    },
    onError: (err) => setModalError((err as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminApi.removeUsuario(id),
    onSuccess: () => {
      setPageError(null);
      qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] });
    },
    onError: (err) => setPageError((err as Error).message),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <button className="btn-primary" onClick={() => { setModalError(null); setShowCreate(true); }}>
          + Nuevo usuario
        </button>
      </div>

      <div className="card mb-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-52">
          <label className="label">Buscar</label>
          <input
            className="input"
            placeholder="Nombre, apellido o email..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setOffset(0); }}
          />
        </div>
        <div>
          <label className="label">Filtrar por rol</label>
          <select className="input w-44" value={rolFilter}
            onChange={(e) => { setRolFilter(e.target.value); setOffset(0); }}>
            <option value="">— Todos —</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {pageError && <div className="mb-4"><ErrorBanner message={pageError} /></div>}

      <div className="card p-0 overflow-hidden">
        {listQ.isLoading ? <div className="p-4"><SkeletonRows count={5} /></div> : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head w-16">#</th>
                <th className="table-head">Email</th>
                <th className="table-head">Nombre completo</th>
                <th className="table-head">Celular</th>
                <th className="table-head">Roles</th>
                <th className="table-head text-right w-48">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listQ.data?.items.map((u) => (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td className="table-cell text-gray-500">#{u.id}</td>
                  <td className="table-cell">{u.email}</td>
                  <td className="table-cell font-medium">{u.nombre} {u.apellido}</td>
                  <td className="table-cell text-gray-500 text-sm">{u.celular ?? '—'}</td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span key={r} className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                          {r}
                        </span>
                      ))}
                      {u.roles.length === 0 && <span className="text-xs text-gray-400">Sin rol</span>}
                    </div>
                  </td>
                  <td className="table-cell text-right">
                    <button className="btn-ghost text-blue-600"
                      onClick={() => { setModalError(null); setEditingRoles(u); }}>
                      Roles
                    </button>
                    <button className="btn-ghost text-red-600"
                      onClick={() => {
                        if (confirm(`¿Eliminar al usuario ${u.email}?`)) deleteMut.mutate(u.id);
                      }}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {listQ.data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-cell text-center text-gray-500 py-8">
                    Sin usuarios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {listQ.data && (
        <Pagination total={listQ.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
      )}

      {showCreate && (
        <Modal isOpen={true} onClose={() => setShowCreate(false)} title="Nuevo usuario">
          {modalError && <div className="mb-3"><ErrorBanner message={modalError} /></div>}
          <CreateForm
            onSubmit={(data) => createMut.mutate(data)}
            isPending={createMut.isPending}
          />
        </Modal>
      )}

      {editingRoles && (
        <Modal isOpen={true} onClose={() => setEditingRoles(null)}
          title={`Roles — ${editingRoles.nombre} ${editingRoles.apellido}`}>
          {modalError && <div className="mb-3"><ErrorBanner message={modalError} /></div>}
          <RolesEditor user={editingRoles}
            onSubmit={(roles) => rolesMut.mutate({ id: editingRoles.id, roles })}
            isPending={rolesMut.isPending} />
        </Modal>
      )}
    </div>
  );
}

function CreateForm({
  onSubmit, isPending,
}: {
  onSubmit: (data: UsuarioAdminCreateInput) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<UsuarioAdminCreateInput>({
    email: '', nombre: '', apellido: '', celular: '', password: '', roles: [],
  });

  const set = (key: keyof UsuarioAdminCreateInput, value: string | string[]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const toggleRol = (r: string) =>
    set('roles', form.roles.includes(r)
      ? form.roles.filter((x) => x !== r)
      : [...form.roles, r]);

  const valid = form.email && form.nombre && form.apellido && form.password.length >= 8;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Nombre *</label>
          <input className="input" value={form.nombre}
            onChange={(e) => set('nombre', e.target.value)} />
        </div>
        <div>
          <label className="label">Apellido *</label>
          <input className="input" value={form.apellido}
            onChange={(e) => set('apellido', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Email *</label>
        <input className="input" type="email" value={form.email}
          onChange={(e) => set('email', e.target.value)} />
      </div>
      <div>
        <label className="label">Celular</label>
        <input className="input" value={form.celular}
          onChange={(e) => set('celular', e.target.value)} />
      </div>
      <div>
        <label className="label">Contraseña * (mín. 8 caracteres)</label>
        <input className="input" type="password" value={form.password}
          onChange={(e) => set('password', e.target.value)} />
      </div>
      <div>
        <label className="label">Roles</label>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm cursor-pointer border rounded px-3 py-2">
              <input type="checkbox" checked={form.roles.includes(r)}
                onChange={() => toggleRol(r)} />
              {r}
            </label>
          ))}
        </div>
      </div>
      <button className="btn-primary mt-2" disabled={!valid || isPending}
        onClick={() => onSubmit({ ...form, celular: form.celular || undefined })}>
        {isPending ? 'Creando...' : 'Crear usuario'}
      </button>
    </div>
  );
}

function RolesEditor({
  user, onSubmit, isPending,
}: {
  user: UsuarioAdmin;
  onSubmit: (roles: string[]) => void;
  isPending: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(user.roles);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {ROLES.map((r) => {
          const checked = selected.includes(r);
          return (
            <label key={r} className="flex items-center gap-2 text-sm cursor-pointer border rounded px-3 py-2">
              <input type="checkbox" checked={checked}
                onChange={() => setSelected((prev) =>
                  checked ? prev.filter((x) => x !== r) : [...prev, r],
                )} />
              {r}
            </label>
          );
        })}
      </div>
      <button className="btn-primary" disabled={isPending}
        onClick={() => onSubmit(selected)}>
        {isPending ? 'Guardando...' : 'Guardar roles'}
      </button>
    </div>
  );
}
