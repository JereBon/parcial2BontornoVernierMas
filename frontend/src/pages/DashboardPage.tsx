import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { categoriasApi } from '../api/categorias';
import { ingredientesApi } from '../api/ingredientes';
import { productosApi } from '../api/productos';
import { pedidosApi } from '../api/pedidos';
import { Skeleton } from '../components/Skeleton';
import { useAuth } from '../auth/AuthContext';

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE:      '#f59e0b',
  CONFIRMADO:     '#3b82f6',
  EN_PREPARACION: '#8b5cf6',
  ENTREGADO:      '#10b981',
  CANCELADO:      '#ef4444',
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE:      'Pendiente',
  CONFIRMADO:     'Confirmado',
  EN_PREPARACION: 'En preparación',
  ENTREGADO:      'Entregado',
  CANCELADO:      'Cancelado',
};

function StatCard({
  title, value, loading, to,
}: {
  title: string;
  value: number | string;
  loading: boolean;
  to?: string;
}) {
  const inner = (
    <div className="card-hover">
      <p className="text-sm text-gray-500">{title}</p>
      {loading ? <Skeleton className="h-8 w-20 mt-2" /> : (
        <p className="text-3xl font-bold text-blue-600 mt-1">{value}</p>
      )}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const { user, hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole('ADMIN');
  const canSeePedidos = hasAnyRole('ADMIN', 'PEDIDOS');

  const productosQ = useQuery({
    queryKey: ['productos', 'count'],
    queryFn: () => productosApi.list({ limit: 1 }),
    enabled: isAdmin,
  });
  const categoriasQ = useQuery({
    queryKey: ['categorias', 'count'],
    queryFn: () => categoriasApi.list({ limit: 1 }),
    enabled: isAdmin,
  });
  const ingredientesQ = useQuery({
    queryKey: ['ingredientes', 'count'],
    queryFn: () => ingredientesApi.list({ limit: 1 }),
    enabled: isAdmin,
  });

  const pendientesQ = useQuery({
    queryKey: ['pedidos', 'count', 'PENDIENTE'],
    queryFn: () => pedidosApi.listAll({ limit: 1, estado: 'PENDIENTE' }),
    enabled: canSeePedidos,
    refetchInterval: 15_000,
  });
  const confirmadosQ = useQuery({
    queryKey: ['pedidos', 'count', 'CONFIRMADO'],
    queryFn: () => pedidosApi.listAll({ limit: 1, estado: 'CONFIRMADO' }),
    enabled: canSeePedidos,
    refetchInterval: 15_000,
  });
  const enPrepQ = useQuery({
    queryKey: ['pedidos', 'count', 'EN_PREPARACION'],
    queryFn: () => pedidosApi.listAll({ limit: 1, estado: 'EN_PREPARACION' }),
    enabled: canSeePedidos,
    refetchInterval: 15_000,
  });
  const entregadosQ = useQuery({
    queryKey: ['pedidos', 'count', 'ENTREGADO'],
    queryFn: () => pedidosApi.listAll({ limit: 1, estado: 'ENTREGADO' }),
    enabled: canSeePedidos,
    refetchInterval: 15_000,
  });
  const canceladosQ = useQuery({
    queryKey: ['pedidos', 'count', 'CANCELADO'],
    queryFn: () => pedidosApi.listAll({ limit: 1, estado: 'CANCELADO' }),
    enabled: canSeePedidos,
    refetchInterval: 15_000,
  });

  const estadoRows = [
    { estado: 'PENDIENTE',      q: pendientesQ },
    { estado: 'CONFIRMADO',     q: confirmadosQ },
    { estado: 'EN_PREPARACION', q: enPrepQ },
    { estado: 'ENTREGADO',      q: entregadosQ },
    { estado: 'CANCELADO',      q: canceladosQ },
  ];

  const pedidosLoading = estadoRows.some(({ q }) => q.isLoading);
  const totalPedidos = estadoRows.reduce((acc, { q }) => acc + (q.data?.total ?? 0), 0);

  const pedidosData = estadoRows
    .map(({ estado, q }) => ({
      name: ESTADO_LABELS[estado],
      value: q.data?.total ?? 0,
      color: ESTADO_COLORS[estado],
      estado,
    }))
    .filter((d) => d.value > 0);

  const barData = estadoRows.map(({ estado, q }) => ({
    name: ESTADO_LABELS[estado],
    cantidad: q.data?.total ?? 0,
    color: ESTADO_COLORS[estado],
  }));

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Hola, {user?.nombre}</h1>
      <p className="text-gray-500 mb-8">Resumen del estado actual.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {canSeePedidos && (
          <>
            <StatCard title="Pedidos pendientes"
              value={pendientesQ.data?.total ?? 0}
              loading={pendientesQ.isLoading}
              to="/pedidos?estado=PENDIENTE" />
            <StatCard title="En preparación"
              value={enPrepQ.data?.total ?? 0}
              loading={enPrepQ.isLoading}
              to="/pedidos?estado=EN_PREPARACION" />
            <StatCard title="Total pedidos"
              value={totalPedidos}
              loading={pedidosLoading}
              to="/pedidos" />
          </>
        )}
        {isAdmin && (
          <>
            <StatCard title="Productos" value={productosQ.data?.total ?? 0}
              loading={productosQ.isLoading} to="/productos" />
            <StatCard title="Categorías" value={categoriasQ.data?.total ?? 0}
              loading={categoriasQ.isLoading} to="/categorias" />
            <StatCard title="Ingredientes" value={ingredientesQ.data?.total ?? 0}
              loading={ingredientesQ.isLoading} to="/ingredientes" />
          </>
        )}
      </div>

      {canSeePedidos && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="font-semibold mb-4">Pedidos por estado</h2>
            {pedidosLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : pedidosData.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-16">Sin pedidos registrados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pedidosData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pedidosData.map((entry) => (
                      <Cell key={entry.estado} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} pedidos`, '']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <h2 className="font-semibold mb-4">Comparativa por estado</h2>
            {pedidosLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [`${value}`, 'Pedidos']} />
                  <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                    {barData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
