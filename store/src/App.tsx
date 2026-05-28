import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PrivateRoute } from './routes/PrivateRoute';
import CatalogoPage from './pages/CatalogoPage';
import ProductoDetallePage from './pages/ProductoDetallePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CarritoPage from './pages/CarritoPage';
import CheckoutPage from './pages/CheckoutPage';
import MisPedidosPage from './pages/MisPedidosPage';
import MiPedidoDetallePage from './pages/MiPedidoDetallePage';
import DireccionesPage from './pages/DireccionesPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<CatalogoPage />} />
          <Route path="producto/:id" element={<ProductoDetallePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="carrito" element={<CarritoPage />} />

          <Route path="checkout" element={
            <PrivateRoute><CheckoutPage /></PrivateRoute>
          } />
          <Route path="mis-pedidos" element={
            <PrivateRoute><MisPedidosPage /></PrivateRoute>
          } />
          <Route path="mis-pedidos/:id" element={
            <PrivateRoute><MiPedidoDetallePage /></PrivateRoute>
          } />
          <Route path="direcciones" element={
            <PrivateRoute><DireccionesPage /></PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
