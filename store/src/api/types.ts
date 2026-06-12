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
  apellido: string;
  celular?: string | null;
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
  imagen_url?: string | null;
}

export interface CategoriaTreeNode extends Categoria {
  children: CategoriaTreeNode[];
}

export interface ProductoIngredienteStore {
  ingrediente_id: number;
  ingrediente: { id: number; nombre: string; es_alergeno: boolean } | null;
  es_removible: boolean;
}

export interface Producto {
  id: number;
  nombre: string;
  precio_base: number;
  descripcion?: string | null;
  stock_disponible: number;
  disponible: boolean;
  categorias: Categoria[];
  producto_ingredientes: ProductoIngredienteStore[];
  imagenes_url?: string[] | null;
}

export type EstadoPedidoCodigo =
  | 'PENDIENTE' | 'CONFIRMADO' | 'EN_PREPARACION'
  | 'ENTREGADO' | 'CANCELADO';

export interface EstadoPedido {
  id: number;
  codigo: EstadoPedidoCodigo | string;
  descripcion: string;
  orden: number;
  es_terminal: boolean;
}

export interface FormaPago {
  id: number;
  codigo: string;
  descripcion: string;
  habilitado: boolean;
}

export interface DetallePedido {
  id: number;
  producto_id: number;
  nombre_snapshot: string;
  precio_snapshot: number;
  cantidad: number;
  subtotal_snap: number;
  personalizacion?: number[] | null;
}

export interface HistorialEstadoPedido {
  id: number;
  estado_desde: EstadoPedido | null;
  estado_hacia: EstadoPedido | null;
  created_at: string;
  usuario_id: number | null;
  motivo: string | null;
}

export interface DireccionEntrega {
  id: number;
  usuario_id: number;
  alias?: string | null;
  linea1: string;
  linea2?: string | null;
  ciudad: string;
  provincia?: string | null;
  codigo_postal?: string | null;
  es_principal: boolean;
  created_at: string;
}

export interface Pedido {
  id: number;
  usuario_id: number;
  estado: EstadoPedido;
  forma_pago: FormaPago;
  subtotal: number;
  descuento: number;
  costo_envio: number;
  total: number;
  direccion: DireccionEntrega | null;
  notas?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PedidoFull extends Pedido {
  detalles: DetallePedido[];
  historial: HistorialEstadoPedido[];
}
