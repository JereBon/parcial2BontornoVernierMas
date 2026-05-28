import { useState } from 'react';

export interface FiltrosCatalogo {
  buscar: string;
  categoriaId: number | '';
  precioMax: number | '';
}

const estadoInicial: FiltrosCatalogo = {
  buscar: '',
  categoriaId: '',
  precioMax: '',
};

export function useFiltrosCatalogo() {
  const [filtros, setFiltros] = useState<FiltrosCatalogo>(estadoInicial);

  const limpiarFiltros = () => setFiltros(estadoInicial);

  return { filtros, setFiltros, limpiarFiltros };
}
