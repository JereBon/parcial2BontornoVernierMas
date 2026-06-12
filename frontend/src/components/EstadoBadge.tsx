import type { EstadoPedidoCodigo } from '../api/types';

const LABEL: Record<EstadoPedidoCodigo, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En preparacion',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

const CLASS: Record<EstadoPedidoCodigo, string> = {
  PENDIENTE: 'badge-pendiente',
  CONFIRMADO: 'badge-confirmado',
  EN_PREPARACION: 'badge-prep',
  ENTREGADO: 'badge-entregado',
  CANCELADO: 'badge-cancelado',
};

export function EstadoBadge({ estado }: { estado: EstadoPedidoCodigo }) {
  return <span className={CLASS[estado]}>{LABEL[estado]}</span>;
}
