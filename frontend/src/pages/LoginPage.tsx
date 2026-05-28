import { useState, useRef, useId } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LocationState {
  from?: { pathname?: string };
}

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const emailId = useId();
  const passwordId = useId();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validar = () => {
    const e: Record<string, string> = {};
    if (!email) e.email = 'Requerido';
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Email invalido';
    if (!password) e.password = 'Requerido';
    else if (password.length < 8) e.password = 'Minimo 8 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    setServerError(null);
    setSubmitting(true);
    try {
      const usr = await login({ email, password });
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
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return null;
  const codes = user?.roles.map((r) => r.codigo) ?? [];
  const isStaff = codes.some((c) => c === 'ADMIN' || c === 'STOCK' || c === 'PEDIDOS');
  if (user && isStaff) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1">Admin Panel</h1>
        <p className="text-sm text-gray-500 mb-6">Solo personal autorizado.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor={emailId} className="label">Email</label>
            <input
              id={emailId}
              ref={emailRef}
              type="email"
              className="input"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: '' })); }}
              autoComplete="email"
            />
            {errors.email && <p className="field-error">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor={passwordId} className="label">Contrasena</label>
            <input
              id={passwordId}
              type="password"
              className="input"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: '' })); }}
              autoComplete="current-password"
            />
            {errors.password && <p className="field-error">{errors.password}</p>}
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-3">
              {serverError}
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary mt-2">
            {submitting ? 'Entrando...' : 'Iniciar sesion'}
          </button>
        </form>
      </div>
    </div>
  );
}
