import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { categoriasApi } from '../api/categorias';
import { ingredientesApi } from '../api/ingredientes';
import { productosApi } from '../api/productos';
import { pedidosApi } from '../api/pedidos';
import { Skeleton } from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';
import { usePolling } from '../hooks/usePolling';

interface Stats {
  pedidosPendientes: number;
  pedidosEnCamino: number;
  productos: number;
  categorias: number;
  ingredientes: number;
}

function StatCard({
  title,
  value,
  loading,
  to,
}: {
  title: string;
  value: number | string;
  loading: boolean;
  to?: string;
}) {
  const inner = (
    <div className="card-hover">
      <p className="text-sm text-gray-500">{title}</p>
      {loading ? (
        <Skeleton className="h-8 w-20 mt-2" />
      ) : (
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

  const [stats, setStats] = useState<Stats>({
    pedidosPendientes: 0,
    pedidosEnCamino: 0,
    productos: 0,
    categorias: 0,
    ingredientes: 0,
  });
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const promises = await Promise.all([
        canSeePedidos
          ? pedidosApi.listAll({ limit: 1, estado: 'PENDIENTE' })
          : Promise.resolve(null),
        canSeePedidos
          ? pedidosApi.listAll({ limit: 1, estado: 'EN_CAMINO' })
          : Promise.resolve(null),
        isAdmin ? productosApi.list({ limit: 1 }) : Promise.resolve(null),
        isAdmin ? categoriasApi.list({ limit: 1 }) : Promise.resolve(null),
        isAdmin ? ingredientesApi.list({ limit: 1 }) : Promise.resolve(null),
      ]);
      setStats({
        pedidosPendientes: promises[0]?.total ?? 0,
        pedidosEnCamino: promises[1]?.total ?? 0,
        productos: promises[2]?.total ?? 0,
        categorias: promises[3]?.total ?? 0,
        ingredientes: promises[4]?.total ?? 0,
      });
    } catch {
      // ignorar error en dashboard
    } finally {
      setLoading(false);
    }
  }, [isAdmin, canSeePedidos]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  usePolling(cargar, 10_000);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Hola, {user?.nombre}</h1>
      <p className="text-gray-500 mb-8">Resumen del estado actual.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {canSeePedidos && (
          <>
            <StatCard
              title="Pedidos pendientes"
              value={stats.pedidosPendientes}
              loading={loading}
              to="/pedidos?estado=PENDIENTE"
            />
            <StatCard
              title="Pedidos en camino"
              value={stats.pedidosEnCamino}
              loading={loading}
              to="/pedidos?estado=EN_CAMINO"
            />
          </>
        )}
        {isAdmin && (
          <>
            <StatCard
              title="Productos"
              value={stats.productos}
              loading={loading}
              to="/productos"
            />
            <StatCard
              title="Categorias"
              value={stats.categorias}
              loading={loading}
              to="/categorias"
            />
            <StatCard
              title="Ingredientes"
              value={stats.ingredientes}
              loading={loading}
              to="/ingredientes"
            />
          </>
        )}
      </div>
    </div>
  );
}
