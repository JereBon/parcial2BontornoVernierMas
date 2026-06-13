import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function MercadoPagoRetornoPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const status = params.get('collection_status') || params.get('status') || 'unknown';
  const pedidoId = params.get('external_reference') || '';

  useEffect(() => {
    const host = window.location.hostname;

    // Si cargó en ngrok (URL pública), redirigir a localhost con los mismos params
    // para que el frontend pueda hacer llamadas al backend local sin mixed-content
    if (host !== 'localhost' && host !== '127.0.0.1') {
      window.location.replace(`http://localhost:5174/mp/retorno${window.location.search}`);
      return;
    }

    // En localhost: navegar al pedido correspondiente
    if (pedidoId) {
      navigate(`/mis-pedidos/${pedidoId}?mp=${status}`, { replace: true });
    } else {
      navigate('/mis-pedidos', { replace: true });
    }
  }, []);

  return (
    <div className="text-center py-16 text-gray-500">Redirigiendo...</div>
  );
}
