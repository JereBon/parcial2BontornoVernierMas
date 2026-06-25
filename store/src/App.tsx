import { useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { useAuth } from './auth/AuthContext';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import CatalogoPage from './pages/CatalogoPage';
import ProductoDetallePage from './pages/ProductoDetallePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CarritoPage from './pages/CarritoPage';
import CheckoutPage from './pages/CheckoutPage';
import MisPedidosPage from './pages/MisPedidosPage';
import MiPedidoDetallePage from './pages/MiPedidoDetallePage';
import DireccionesPage from './pages/DireccionesPage';
import MercadoPagoRetornoPage from './pages/MercadoPagoRetornoPage';

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
        <Route element={<Layout />}>
          <Route index element={<CatalogoPage />} />
          <Route path="producto/:id" element={<ProductoDetallePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="carrito" element={<CarritoPage />} />

          <Route path="checkout" element={
            <ProtectedRoute><CheckoutPage /></ProtectedRoute>
          } />
          <Route path="mis-pedidos" element={
            <ProtectedRoute><MisPedidosPage /></ProtectedRoute>
          } />
          <Route path="mis-pedidos/:id" element={
            <ProtectedRoute><MiPedidoDetallePage /></ProtectedRoute>
          } />
          <Route path="direcciones" element={
            <ProtectedRoute><DireccionesPage /></ProtectedRoute>
          } />

          <Route path="mp/retorno" element={<MercadoPagoRetornoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
