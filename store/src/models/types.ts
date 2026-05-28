export type RolCodigo = 'ADMIN' | 'STOCK' | 'PEDIDOS' | 'CLIENT';

export interface Rol {
  id: number;
  codigo: RolCodigo | string;
  nombre: string;
}

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  roles: Rol[];
}

export interface Paginated<T> {
  total: number;
  items: T[];
  limit: number;
  offset: number;
}

export interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string | null;
  parent_id?: number | null;
}

export interface CategoriaTreeNode extends Categoria {
  children: CategoriaTreeNode[];
}

export interface Ingrediente {
  id: number;
  nombre: string;
}

export interface ProductoIngrediente {
  id: number;
  nombre: string;
  es_alergeno: boolean;
}

export interface Producto {
  id: number;
  nombre: string;
  precio: number;
  descripcion?: string | null;
  stock_cantidad: number;
  disponible: boolean;
  categorias: Categoria[];
  ingredientes: ProductoIngrediente[];
}

export type EstadoPedidoCodigo =
  | 'PENDIENTE' | 'CONFIRMADO' | 'EN_PREPARACION'
  | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';

export interface EstadoPedido {
  id: number;
  codigo: EstadoPedidoCodigo;
  nombre: string;
  orden: number;
}

export interface FormaPago {
  id: number;
  codigo: string;
  nombre: string;
}

export interface DetallePedido {
  id: number;
  producto_id: number;
  producto_nombre: string;
  producto_precio: number;
  cantidad: number;
  subtotal: number;
}

export interface HistorialEstadoPedido {
  id: number;
  estado_anterior: EstadoPedido | null;
  estado_nuevo: EstadoPedido;
  changed_at: string;
  changed_by_id: number | null;
  nota: string | null;
}

export interface Pedido {
  id: number;
  usuario_id: number;
  estado: EstadoPedido;
  forma_pago: FormaPago;
  total: number;
  direccion_snapshot: string;
  notas?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PedidoFull extends Pedido {
  detalles: DetallePedido[];
  historial: HistorialEstadoPedido[];
}

export interface DireccionEntrega {
  id: number;
  usuario_id: number;
  alias: string;
  calle: string;
  numero: string;
  ciudad: string;
  codigo_postal?: string | null;
  detalles?: string | null;
  principal: boolean;
  created_at: string;
}
