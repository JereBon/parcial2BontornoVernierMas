import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { PedidosProvider } from './context/PedidosContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <PedidosProvider>
        <App />
      </PedidosProvider>
    </AuthProvider>
  </StrictMode>,
);
