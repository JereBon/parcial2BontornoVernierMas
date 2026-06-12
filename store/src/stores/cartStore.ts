import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  producto_id: number;
  nombre: string;
  precio: number;
  cantidad: number;
  personalizacion: number[];
}

interface CartState {
  items: CartItem[];
  itemCount: () => number;
  total: () => number;
  addItem: (
    item: Omit<CartItem, 'cantidad' | 'personalizacion'>,
    cantidad?: number,
    personalizacion?: number[],
  ) => void;
  removeItem: (producto_id: number) => void;
  setQty: (producto_id: number, cantidad: number) => void;
  setPersonalizacion: (producto_id: number, personalizacion: number[]) => void;
  setPrice: (producto_id: number, precio: number, nombre?: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      itemCount: () => get().items.reduce((acc, i) => acc + i.cantidad, 0),
      total: () =>
        Math.round(get().items.reduce((acc, i) => acc + i.precio * i.cantidad, 0) * 100) / 100,
      addItem: (item, cantidad = 1, personalizacion = []) =>
        set((s) => {
          const qty = Math.max(1, cantidad);
          const existing = s.items.find((i) => i.producto_id === item.producto_id);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.producto_id === item.producto_id
                  ? { ...i, cantidad: i.cantidad + qty, personalizacion }
                  : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, cantidad: qty, personalizacion }] };
        }),
      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.producto_id !== id) })),
      setQty: (id, cantidad) =>
        set((s) => {
          if (cantidad <= 0) return { items: s.items.filter((i) => i.producto_id !== id) };
          return { items: s.items.map((i) => (i.producto_id === id ? { ...i, cantidad } : i)) };
        }),
      setPersonalizacion: (id, personalizacion) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.producto_id === id ? { ...i, personalizacion } : i,
          ),
        })),
      setPrice: (id, precio, nombre) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.producto_id === id ? { ...i, precio, nombre: nombre ?? i.nombre } : i,
          ),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: 'foodstore_cart_v2' }
  )
);
