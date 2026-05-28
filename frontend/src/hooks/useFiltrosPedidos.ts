import { useState } from 'react';
import type { EstadoPedidoCodigo } from '../models/types';

export function useFiltrosPedidos() {
  const [estado, setEstado] = useState<EstadoPedidoCodigo | ''>('');

  const limpiar = () => setEstado('');

  return { estado, setEstado, limpiar };
}
