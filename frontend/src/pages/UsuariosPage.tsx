import { useState, useEffect, useCallback, useRef, useId } from 'react';
import { adminApi } from '../api/admin';
import type { UsuarioAdminCreateInput } from '../api/admin';
import type { UsuarioAdmin } from '../models/types';
import { Modal } from '../components/Modal';
import { SkeletonRows } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { Pagination } from '../components/Pagination';

const LIMIT = 20;
const ROLES = ['ADMIN', 'STOCK', 'PEDIDOS', 'CLIENT'] as const;

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [errorPagina, setErrorPagina] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [rolFilter, setRolFilter] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editandoRoles, setEditandoRoles] = useState<UsuarioAdmin | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const emailId = useId();
  const nombreId = useId();
  const passwordId = useId();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [rolesSeleccionados, setRolesSeleccionados] = useState<string[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await adminApi.listUsuarios({
        skip: offset,
        limit: LIMIT,
        rol: rolFilter || undefined,
      });
      setUsuarios(data.items);
      setTotal(data.total);
      setErrorPagina(null);
    } catch (err) {
      setErrorPagina((err as Error).message);
    } finally {
      setCargando(false);
    }
  }, [offset, rolFilter]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (isCreateOpen) {
      setEmail('');
      setNombre('');
      setPassword('');
      setRolesSeleccionados([]);
      setErrores({});
      setErrorForm(null);
      setTimeout(() => emailRef.current?.focus(), 50);
    }
  }, [isCreateOpen]);

  const validarCrear = () => {
    const e: Record<string, string> = {};
    if (!email) e.email = 'Requerido';
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Email invalido';
    if (!nombre || nombre.trim().length < 2) e.nombre = 'Minimo 2 caracteres';
    if (!password) e.password = 'Requerido';
    else if (password.length < 8) e.password = 'Minimo 8 caracteres';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarCrear()) return;
    setErrorForm(null);
    setGuardando(true);
    const payload: UsuarioAdminCreateInput = {
      email: email.trim(),
      nombre: nombre.trim(),
      password,
      roles: rolesSeleccionados,
    };
    try {
      await adminApi.createUsuario(payload);
      await cargar();
      setIsCreateOpen(false);
    } catch (err) {
      setErrorForm((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (u: UsuarioAdmin) => {
    if (!confirm(`Eliminar usuario ${u.email}?`)) return;
    try {
      await adminApi.removeUsuario(u.id);
      await cargar();
      setErrorPagina(null);
    } catch (err) {
      setErrorPagina((err as Error).message);
    }
  };

  const handleGuardarRoles = async (roles: string[]) => {
    if (!editandoRoles) return;
    setGuardando(true);
    try {
      await adminApi.replaceRoles(editandoRoles.id, roles);
      await cargar();
      setEditandoRoles(null);
    } catch (err) {
      setErrorForm((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const toggleRol = (r: string) => {
    setRolesSeleccionados((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <button
          className="btn-primary"
          onClick={() => { setErrorForm(null); setIsCreateOpen(true); }}
        >
          Nuevo usuario
        </button>
      </div>

      <div className="card mb-4">
        <label className="label">Filtrar por rol</label>
        <select
          className="input w-56"
          value={rolFilter}
          onChange={(e) => { setRolFilter(e.target.value); setOffset(0); }}
        >
          <option value="">— Todos —</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {errorPagina && (
        <div className="mb-4">
          <ErrorBanner message={errorPagina} />
        </div>
      )}

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
                <th className="table-head">Email</th>
                <th className="table-head">Nombre</th>
                <th className="table-head">Roles</th>
                <th className="table-head text-right w-48">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="table-cell text-gray-500">#{u.id}</td>
                  <td className="table-cell">{u.email}</td>
                  <td className="table-cell font-medium">{u.nombre}</td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span
                          key={r}
                          className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="table-cell text-right">
                    <button
                      className="btn-ghost text-blue-600"
                      onClick={() => { setErrorForm(null); setEditandoRoles(u); }}
                    >
                      Roles
                    </button>
                    <button
                      className="btn-ghost text-red-600"
                      onClick={() => handleEliminar(u)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination total={total} limit={LIMIT} offset={offset} onChange={setOffset} />

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Nuevo usuario"
      >
        <form onSubmit={handleCrear} className="flex flex-col gap-4">
          <div>
            <label htmlFor={emailId} className="label">Email</label>
            <input
              id={emailId}
              ref={emailRef}
              type="email"
              className="input"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrores((p) => ({ ...p, email: '' })); }}
            />
            {errores.email && <p className="field-error">{errores.email}</p>}
          </div>

          <div>
            <label htmlFor={nombreId} className="label">Nombre</label>
            <input
              id={nombreId}
              className="input"
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); setErrores((p) => ({ ...p, nombre: '' })); }}
            />
            {errores.nombre && <p className="field-error">{errores.nombre}</p>}
          </div>

          <div>
            <label htmlFor={passwordId} className="label">Contrasena</label>
            <input
              id={passwordId}
              type="password"
              className="input"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrores((p) => ({ ...p, password: '' })); }}
            />
            {errores.password && <p className="field-error">{errores.password}</p>}
          </div>

          <div>
            <p className="label">Roles</p>
            <div className="flex flex-wrap gap-3">
              {ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rolesSeleccionados.includes(r)}
                    onChange={() => toggleRol(r)}
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>

          {errorForm && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-3">
              {errorForm}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={guardando}>
              {guardando ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>

      {editandoRoles && (
        <Modal
          isOpen
          onClose={() => setEditandoRoles(null)}
          title={`Roles de ${editandoRoles.email}`}
        >
          <RolesEditor
            usuario={editandoRoles}
            onSubmit={handleGuardarRoles}
            isPending={guardando}
          />
        </Modal>
      )}
    </div>
  );
}

function RolesEditor({
  usuario,
  onSubmit,
  isPending,
}: {
  usuario: UsuarioAdmin;
  onSubmit: (roles: string[]) => void;
  isPending: boolean;
}) {
  const [seleccionados, setSeleccionados] = useState<string[]>(usuario.roles);

  const toggle = (r: string) => {
    setSeleccionados((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {ROLES.map((r) => (
          <label
            key={r}
            className="flex items-center gap-2 text-sm cursor-pointer border rounded px-3 py-2"
          >
            <input
              type="checkbox"
              checked={seleccionados.includes(r)}
              onChange={() => toggle(r)}
            />
            {r}
          </label>
        ))}
      </div>
      <button
        className="btn-primary"
        disabled={isPending}
        onClick={() => onSubmit(seleccionados)}
      >
        {isPending ? 'Guardando...' : 'Guardar roles'}
      </button>
    </div>
  );
}
