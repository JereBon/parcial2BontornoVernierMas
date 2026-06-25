import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function RegisterPage() {
  const { register, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { nombre: '', apellido: '', email: '', password: '', password2: '' },
    onSubmit: async ({ value }) => {
      setServerError(null);
      if (value.password !== value.password2) {
        setServerError('Las contrasenas no coinciden');
        return;
      }
      try {
        await register({
          nombre: value.nombre,
          apellido: value.apellido,
          email: value.email,
          password: value.password,
        });
        navigate('/', { replace: true });
      } catch (err) {
        setServerError((err as Error).message || 'No se pudo crear la cuenta');
      }
    },
  });

  if (isLoading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex items-center justify-center py-8">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1">Crear cuenta</h1>
        <p className="text-sm text-gray-500 mb-6">
          Ya tenes cuenta? <Link to="/login" className="text-orange-600 hover:underline">Inicia sesion</Link>
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-3">
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
                    autoComplete="given-name"
                  />
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <p className="field-error">{field.state.meta.errors.join(', ')}</p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="apellido"
              validators={{
                onChange: ({ value }) => (!value || value.trim().length < 2 ? 'Minimo 2 caracteres' : undefined),
              }}
            >
              {(field) => (
                <div>
                  <label htmlFor={field.name} className="label">Apellido</label>
                  <input
                    id={field.name}
                    className="input"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    autoComplete="family-name"
                  />
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <p className="field-error">{field.state.meta.errors.join(', ')}</p>
                  )}
                </div>
              )}
            </form.Field>
          </div>

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
              onChange: ({ value }) =>
                !value ? 'Requerido' : value.length < 8 ? 'Minimo 8 caracteres' : undefined,
            }}
          >
            {(field) => (
              <div>
                <label htmlFor={field.name} className="label">Contrasena</label>
                <input
                  id={field.name}
                  type="password"
                  className="input"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  autoComplete="new-password"
                />
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                  <p className="field-error">{field.state.meta.errors.join(', ')}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="password2">
            {(field) => (
              <div>
                <label htmlFor={field.name} className="label">Repetir contrasena</label>
                <input
                  id={field.name}
                  type="password"
                  className="input"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  autoComplete="new-password"
                />
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
                {isSubmitting ? 'Creando...' : 'Crear cuenta'}
              </button>
            )}
          </form.Subscribe>
        </form>
      </div>
    </div>
  );
}
