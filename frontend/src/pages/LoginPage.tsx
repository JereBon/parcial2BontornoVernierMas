import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface LocationState {
  from?: { pathname?: string };
}

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const usr = await login(value);
        const codes = usr.roles.map((r) => r.codigo);
        const isStaff = codes.some((c) => c === 'ADMIN' || c === 'STOCK' || c === 'PEDIDOS');
        if (!isStaff) {
          setServerError('Esta cuenta no tiene permisos de staff. Usa la app del Store.');
          return;
        }
        const from = (location.state as LocationState | null)?.from?.pathname ?? '/';
        navigate(from, { replace: true });
      } catch (err) {
        setServerError((err as Error).message || 'No se pudo iniciar sesion');
      }
    },
  });

  if (isLoading) return null;
  const codes = user?.roles.map((r) => r.codigo) ?? [];
  const isStaff = codes.some((c) => c === 'ADMIN' || c === 'STOCK' || c === 'PEDIDOS');
  if (user && isStaff) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1">Admin Panel</h1>
        <p className="text-sm text-gray-500 mb-6">Solo personal autorizado.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => {
                if (!value) return 'Requerido';
                if (!/^\S+@\S+\.\S+$/.test(value)) return 'Email invalido';
                return undefined;
              },
            }}
          >
            {(field) => (
              <div>
                <label htmlFor={field.name} className="label">Email</label>
                <input
                  id={field.name}
                  name={field.name}
                  type="email"
                  className="input"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  autoComplete="email"
                />
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                  <p className="field-error">{field.state.meta.errors.join(', ')}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="password"
            validators={{
              onChange: ({ value }) => (!value ? 'Requerido' : value.length < 8 ? 'Minimo 8 caracteres' : undefined),
            }}
          >
            {(field) => (
              <div>
                <label htmlFor={field.name} className="label">Contrasena</label>
                <input
                  id={field.name}
                  name={field.name}
                  type="password"
                  className="input"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  autoComplete="current-password"
                />
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                  <p className="field-error">{field.state.meta.errors.join(', ')}</p>
                )}
              </div>
            )}
          </form.Field>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-3">
              {serverError}
            </div>
          )}

          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) => (
              <button type="submit" disabled={!canSubmit} className="btn-primary mt-2">
                {isSubmitting ? 'Entrando...' : 'Iniciar sesion'}
              </button>
            )}
          </form.Subscribe>
        </form>
      </div>
    </div>
  );
}
