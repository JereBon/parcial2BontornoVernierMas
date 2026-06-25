import { api } from './client';
import type { CategoriaTreeNode, Paginated, Producto } from './types';

export interface ProductoFilters {
  page?: number;
  size?: number;
  nombre?: string;
  categoria_ids?: number[];
  disponible?: boolean;
  precio_min?: number;
  precio_max?: number;
}

export const catalogoApi = {
  productos: (filters: ProductoFilters = {}) => {
    const { categoria_ids, ...rest } = filters;
    return api.get<Paginated<Producto>>('/productos/', {
      params: categoria_ids?.length
        ? { ...rest, categoria_ids }
        : rest,
      paramsSerializer: { indexes: null },
    }).then((r) => r.data);
  },

  productoById: (id: number) =>
    api.get<Producto>(`/productos/${id}`).then((r) => r.data),

  categoriasTree: () =>
    api.get<CategoriaTreeNode[]>('/categorias/tree').then((r) => r.data),
};
