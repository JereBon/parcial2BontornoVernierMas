import { api } from './client';
import type { UnidadMedida } from './types';

export const lookupsApi = {
  unidadesMedida: () =>
    api.get<UnidadMedida[]>('/lookups/unidades-medida').then((r) => r.data),
};
