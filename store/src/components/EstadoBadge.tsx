import type { EstadoPedidoCodigo } from '../api/types';

const LABEL: Record<EstadoPedidoCodigo, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREP: 'En preparacion',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

const CLASS: Record<EstadoPedidoCodigo, string> = {
  PENDIENTE: 'badge-pendiente',
  CONFIRMADO: 'badge-confirmado',
  EN_PREP: 'badge-prep',
  ENTREGADO: 'badge-entregado',
  CANCELADO: 'badge-cancelado',
};

export function EstadoBadge({ estado }: { estado: string }) {
  const code = estado as EstadoPedidoCodigo;
  return (
    <span className={CLASS[code] ?? 'badge'}>
      {LABEL[code] ?? estado}
    </span>
  );
}
