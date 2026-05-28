import { api } from './client';
import type { CategoriaTreeNode, Paginated, Producto } from './types';

export interface ProductoFilters {
  skip?: number;
  limit?: number;
  nombre?: string;
  categoria_id?: number;
  disponible?: boolean;
  precio_min?: number;
  precio_max?: number;
}

export const catalogoApi = {
  productos: (filters: ProductoFilters = {}) =>
    api.get<Paginated<Producto>>('/productos/', { params: filters }).then((r) => r.data),

  productoById: (id: number) =>
    api.get<Producto>(`/productos/${id}`).then((r) => r.data),

  categoriasTree: () =>
    api.get<CategoriaTreeNode[]>('/categorias/tree').then((r) => r.data),
};
