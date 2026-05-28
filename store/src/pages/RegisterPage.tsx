import { useId, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register, user, isLoading } = useAuth();
  const navigate = useNavigate();

  const nombreId = useId();
  const emailId = useId();
  const passwordId = useId();
  const password2Id = useId();
  const nombreRef = useRef<HTMLInputElement>(null);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const validar = () => {
    const e: Record<string, string> = {};
    if (!nombre || nombre.trim().length < 2) e.nombre = 'Minimo 2 caracteres';
    if (!email) e.email = 'Requerido';
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Email invalido';
    if (!password) e.password = 'Requerido';
    else if (password.length < 8) e.password = 'Minimo 8 caracteres';
    if (password !== password2) e.password2 = 'Las contrasenas no coinciden';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    setServerError(null);
    setEnviando(true);
    try {
      await register({ nombre: nombre.trim(), email: email.trim(), password });
      navigate('/', { replace: true });
    } catch (err) {
      setServerError((err as Error).message || 'No se pudo crear la cuenta');
    } finally {
      setEnviando(false);
    }
  };

  if (isLoading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex items-center justify-center py-8">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1">Crear cuenta</h1>
        <p className="text-sm text-gray-500 mb-6">
          Ya tenes cuenta?{' '}
          <Link to="/login" className="text-orange-600 hover:underline">Inicia sesion</Link>
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor={nombreId} className="label">Nombre</label>
            <input
              id={nombreId}
              ref={nombreRef}
              className="input"
              value={nombre}
              autoComplete="name"
              onChange={(e) => { setNombre(e.target.value); setErrores((p) => ({ ...p, nombre: '' })); }}
            />
            {errores.nombre && <p className="field-error">{errores.nombre}</p>}
          </div>

          <div>
            <label htmlFor={emailId} className="label">Email</label>
            <input
              id={emailId}
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
              autoComplete="new-password"
              onChange={(e) => { setPassword(e.target.value); setErrores((p) => ({ ...p, password: '' })); }}
            />
            {errores.password && <p className="field-error">{errores.password}</p>}
          </div>

          <div>
            <label htmlFor={password2Id} className="label">Repetir contrasena</label>
            <input
              id={password2Id}
              type="password"
              className="input"
              value={password2}
              autoComplete="new-password"
              onChange={(e) => { setPassword2(e.target.value); setErrores((p) => ({ ...p, password2: '' })); }}
            />
            {errores.password2 && <p className="field-error">{errores.password2}</p>}
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-3">
              {serverError}
            </div>
          )}

          <button type="submit" disabled={enviando} className="btn-primary mt-2">
            {enviando ? 'Creando...' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}
