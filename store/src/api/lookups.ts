import { api } from './client';
import type { EstadoPedido, FormaPago } from './types';

export const lookupsApi = {
  estadosPedido: () =>
    api.get<EstadoPedido[]>('/lookups/estados-pedido').then((r) => r.data),

  formasPago: () =>
    api.get<FormaPago[]>('/lookups/formas-pago').then((r) => r.data),
};
