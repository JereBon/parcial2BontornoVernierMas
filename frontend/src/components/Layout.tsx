import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useAdminOrdersFeed } from '../hooks/useAdminOrdersFeed';

interface NavItem {
  to: string;
  label: string;
  roles?: string[];
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/pedidos', label: 'Pedidos', roles: ['ADMIN', 'PEDIDOS'] },
  { to: '/cajero', label: 'Cajero', roles: ['ADMIN', 'PEDIDOS'] },
  { to: '/productos', label: 'Productos', roles: ['ADMIN'] },
  { to: '/categorias', label: 'Categorias', roles: ['ADMIN'] },
  { to: '/ingredientes', label: 'Ingredientes', roles: ['ADMIN'] },
  { to: '/stock', label: 'Stock', roles: ['ADMIN', 'STOCK'] },
  { to: '/usuarios', label: 'Usuarios', roles: ['ADMIN'] },
];

export function Layout() {
  const { user, logout, hasAnyRole, roleCodes } = useAuth();
  const navigate = useNavigate();
  const { connected } = useAdminOrdersFeed();

  const visibleNav = NAV.filter((item) => !item.roles || hasAnyRole(...item.roles));

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-60 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-700">
          <h1 className="text-lg font-bold tracking-wide">Admin Panel</h1>
          <p className="text-xs text-slate-400 mt-1">FoodStore</p>
        </div>
        <nav className="flex-1 py-4">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block px-6 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-slate-700">
          {/* WS connection badge */}
          {user && (
            <div className={`flex items-center gap-1.5 mb-3 text-xs font-medium px-2 py-1 rounded ${
              connected
                ? 'bg-green-900 text-green-300'
                : 'bg-red-900 text-red-300'
            }`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
              {connected ? 'En línea' : 'Sin conexión'}
            </div>
          )}
          <p className="text-xs text-slate-400">{user?.email}</p>
          <p className="text-sm font-semibold">{user?.nombre}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {roleCodes.map((c) => (
              <span key={c} className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-700 text-white">
                {c}
              </span>
            ))}
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full btn-secondary !bg-slate-800 !border-slate-700 !text-slate-100 hover:!bg-slate-700"
          >
            Cerrar sesion
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-8 max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
