import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function MercadoPagoRetornoPage() {
  const [params] = useSearchParams();
  const status = params.get('status');
  const pedidoId = params.get('external_reference');
  const navigate = useNavigate();

  useEffect(() => {
    if (pedidoId) {
      navigate(`/mis-pedidos/${pedidoId}?mp=${status ?? 'unknown'}`, { replace: true });
    } else {
      navigate('/mis-pedidos', { replace: true });
    }
  }, []);

  return <div className="text-center py-16 text-gray-500">Redirigiendo...</div>;
}
