import type { EstadoPedidoCodigo } from '../models/types';

const LABEL: Record<EstadoPedidoCodigo, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En preparacion',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

const CLASS: Record<EstadoPedidoCodigo, string> = {
  PENDIENTE: 'badge-pendiente',
  CONFIRMADO: 'badge-confirmado',
  EN_PREPARACION: 'badge-prep',
  EN_CAMINO: 'badge-camino',
  ENTREGADO: 'badge-entregado',
  CANCELADO: 'badge-cancelado',
};

export function EstadoBadge({ estado }: { estado: EstadoPedidoCodigo }) {
  return <span className={CLASS[estado]}>{LABEL[estado]}</span>;
}
