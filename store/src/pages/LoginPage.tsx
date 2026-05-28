import { useId, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const validar = () => {
    const e: Record<string, string> = {};
    if (!email) e.email = 'Requerido';
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Email invalido';
    if (!password) e.password = 'Requerido';
    else if (password.length < 8) e.password = 'Minimo 8 caracteres';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    setServerError(null);
    setEnviando(true);
    try {
      await login({ email: email.trim(), password });
      const from = (location.state as LocationState | null)?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    } catch (err) {
      setServerError((err as Error).message || 'No se pudo iniciar sesion');
    } finally {
      setEnviando(false);
    }
  };

  if (isLoading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex items-center justify-center py-8">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1">Iniciar sesion</h1>
        <p className="text-sm text-gray-500 mb-6">
          No tenes cuenta?{' '}
          <Link to="/register" className="text-orange-600 hover:underline">Registrate</Link>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor={emailId} className="label">Email</label>
            <input
              id={emailId}
              ref={emailRef}
              type="email"
              className="input"
              value={email}
              autoComplete="email"
              onChange={(e) => { setEmail(e.target.value); setErrores((p) => ({ ...p, email: '' })); }}
            />
            {errores.email && <p className="field-error">{errores.email}</p>}
          </div>

          <div>
            <label htmlFor={passwordId} className="label">Contrasena</label>
            <input
              id={passwordId}
              type="password"
              className="input"
              value={password}
              autoComplete="current-password"
              onChange={(e) => { setPassword(e.target.value); setErrores((p) => ({ ...p, password: '' })); }}
            />
            {errores.password && <p className="field-error">{errores.password}</p>}
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-3">
              {serverError}
            </div>
          )}

          <button type="submit" disabled={enviando} className="btn-primary mt-2">
            {enviando ? 'Entrando...' : 'Iniciar sesion'}
          </button>
        </form>
      </div>
    </div>
  );
}
