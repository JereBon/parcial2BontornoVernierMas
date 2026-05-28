import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute } from './routes/PrivateRoute';
import { Layout } from './components/Layout';
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <PrivateRoute roles={['ADMIN', 'STOCK', 'PEDIDOS']}>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<DashboardPage />} />

          <Route
            path="pedidos"
            element={
              <PrivateRoute roles={['ADMIN', 'PEDIDOS']}>
                <PedidosPage />
              </PrivateRoute>
            }
          />
          <Route
            path="pedidos/:id"
            element={
              <PrivateRoute roles={['ADMIN', 'PEDIDOS']}>
                <PedidoDetallePage />
              </PrivateRoute>
            }
          />
          <Route
            path="cajero"
            element={
              <PrivateRoute roles={['ADMIN', 'PEDIDOS']}>
                <CajeroPage />
              </PrivateRoute>
            }
          />

          <Route
            path="stock"
            element={
              <PrivateRoute roles={['ADMIN', 'STOCK']}>
                <StockPage />
              </PrivateRoute>
            }
          />

          <Route
            path="productos"
            element={
              <PrivateRoute roles={['ADMIN']}>
                <ProductosPage />
              </PrivateRoute>
            }
          />
          <Route
            path="categorias"
            element={
              <PrivateRoute roles={['ADMIN']}>
                <CategoriasPage />
              </PrivateRoute>
            }
          />
          <Route
            path="ingredientes"
            element={
              <PrivateRoute roles={['ADMIN']}>
                <IngredientesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="usuarios"
            element={
              <PrivateRoute roles={['ADMIN']}>
                <UsuariosPage />
              </PrivateRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
