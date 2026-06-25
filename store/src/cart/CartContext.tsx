import type { ReactNode } from 'react';
import { useCartStore, type CartItem } from '../stores/cartStore';

export type { CartItem };

export function CartProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useCart() {
  const store = useCartStore();
  return {
    items: store.items,
    itemCount: store.itemCount(),
    total: store.total(),
    addItem: store.addItem,
    removeItem: store.removeItem,
    setQty: store.setQty,
    setPersonalizacion: store.setPersonalizacion,
    setPrice: store.setPrice,
    clear: store.clear,
  };
}
