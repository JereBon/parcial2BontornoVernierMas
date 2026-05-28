import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCarrito } from '../context/CarritoContext';

export function Layout() {
  const { user, logout } = useAuth();
  const { itemCount } = useCarrito();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between max-w-6xl">
          <Link to="/" className="text-2xl font-bold text-orange-600">
            FoodStore
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            <NavLink to="/" end className={({ isActive }) =>
              isActive ? 'text-orange-600 font-semibold' : 'text-gray-700 hover:text-orange-600'
            }>
              Catalogo
            </NavLink>

            {user && (
              <>
                <NavLink to="/mis-pedidos" className={({ isActive }) =>
                  isActive ? 'text-orange-600 font-semibold' : 'text-gray-700 hover:text-orange-600'
                }>
                  Mis pedidos
                </NavLink>
                <NavLink to="/direcciones" className={({ isActive }) =>
                  isActive ? 'text-orange-600 font-semibold' : 'text-gray-700 hover:text-orange-600'
                }>
                  Direcciones
                </NavLink>
              </>
            )}

            <Link to="/carrito" className="relative btn-ghost">
              Carrito
              {itemCount > 0 && (
                <span className="ml-1 bg-orange-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                  {itemCount}
                </span>
              )}
            </Link>

            {user ? (
              <div className="flex items-center gap-2 pl-3 border-l">
                <span className="text-sm text-gray-600">Hola, <strong>{user.nombre}</strong></span>
                <button onClick={handleLogout} className="btn-ghost">Salir</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-3 border-l">
                <Link to="/login" className="btn-ghost">Ingresar</Link>
                <Link to="/register" className="btn-primary">Registrarse</Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto p-6 max-w-6xl">
          <Outlet />
        </div>
      </main>

      <footer className="bg-white border-t mt-12">
        <div className="container mx-auto px-6 py-4 max-w-6xl text-center text-sm text-gray-500">
          FoodStore — Parcial Prog 4
        </div>
      </footer>
    </div>
  );
}
