import { useState } from 'react';

export interface FiltrosProductos {
  buscar: string;
  categoriaId: number | '';
  disponible: 'todos' | 'si' | 'no';
}

const estadoInicial: FiltrosProductos = {
  buscar: '',
  categoriaId: '',
  disponible: 'todos',
};

export function useFiltrosProductos() {
  const [filtros, setFiltros] = useState<FiltrosProductos>(estadoInicial);

  const limpiarFiltros = () => setFiltros(estadoInicial);

  return { filtros, setFiltros, limpiarFiltros };
}
