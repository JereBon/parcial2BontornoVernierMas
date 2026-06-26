import { useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { useAuth } from './auth/AuthContext';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CategoriasPage from './pages/CategoriasPage';
import IngredientesPage from './pages/IngredientesPage';
import ProductosPage from './pages/ProductosPage';
import PedidosPage from './pages/PedidosPage';
import PedidoDetallePage from './pages/PedidoDetallePage';
import CajeroPage from './pages/CajeroPage';
import StockPage from './pages/StockPage';
import UsuariosPage from './pages/UsuariosPage';

function IdleWatcher() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const handleIdle = useCallback(async () => {
    if (!isAuthenticated) return;
    await logout();
    navigate('/login', { replace: true });
  }, [isAuthenticated, logout, navigate]);
  useIdleTimeout(handleIdle);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <IdleWatcher />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={
          <ProtectedRoute roles={['ADMIN', 'STOCK', 'PEDIDOS']}><Layout /></ProtectedRoute>
        }>
          <Route index element={<DashboardPage />} />

          {}
          <Route path="pedidos" element={
            <ProtectedRoute roles={['ADMIN', 'PEDIDOS']}><PedidosPage /></ProtectedRoute>
          } />
          <Route path="pedidos/:id" element={
            <ProtectedRoute roles={['ADMIN', 'PEDIDOS']}><PedidoDetallePage /></ProtectedRoute>
          } />
          <Route path="cajero" element={
            <ProtectedRoute roles={['ADMIN', 'PEDIDOS']}><CajeroPage /></ProtectedRoute>
          } />

          {}
          <Route path="productos" element={
            <ProtectedRoute roles={['ADMIN']}><ProductosPage /></ProtectedRoute>
          } />
          <Route path="categorias" element={
            <ProtectedRoute roles={['ADMIN']}><CategoriasPage /></ProtectedRoute>
          } />
          <Route path="ingredientes" element={
            <ProtectedRoute roles={['ADMIN']}><IngredientesPage /></ProtectedRoute>
          } />
          <Route path="stock" element={
            <ProtectedRoute roles={['ADMIN', 'STOCK']}><StockPage /></ProtectedRoute>
          } />
          <Route path="usuarios" element={
            <ProtectedRoute roles={['ADMIN']}><UsuariosPage /></ProtectedRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
