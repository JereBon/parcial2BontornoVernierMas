import type { Ingrediente, Paginated } from '../models/types';

export interface IngredientesState {
  ingredientes: Ingrediente[];
  total: number;
  cargando: boolean;
  error: string | null;
}

export type IngredientesAction =
  | { type: 'CARGAR_INICIO' }
  | { type: 'CARGAR_EXITO'; payload: Paginated<Ingrediente> }
  | { type: 'CARGAR_ERROR'; payload: string }
  | { type: 'AGREGAR'; payload: Ingrediente }
  | { type: 'ACTUALIZAR'; payload: Ingrediente }
  | { type: 'ELIMINAR'; payload: number };

export const ingredientesEstadoInicial: IngredientesState = {
  ingredientes: [],
  total: 0,
  cargando: false,
  error: null,
};

export function ingredientesReducer(
  state: IngredientesState,
  action: IngredientesAction,
): IngredientesState {
  switch (action.type) {
    case 'CARGAR_INICIO':
      return { ...state, cargando: true, error: null };
    case 'CARGAR_EXITO':
      return {
        ...state,
        cargando: false,
        ingredientes: action.payload.items,
        total: action.payload.total,
      };
    case 'CARGAR_ERROR':
      return { ...state, cargando: false, error: action.payload };
    case 'AGREGAR':
      return {
        ...state,
        ingredientes: [...state.ingredientes, action.payload],
        total: state.total + 1,
      };
    case 'ACTUALIZAR':
      return {
        ...state,
        ingredientes: state.ingredientes.map((i) =>
          i.id === action.payload.id ? action.payload : i,
        ),
      };
    case 'ELIMINAR':
      return {
        ...state,
        ingredientes: state.ingredientes.filter((i) => i.id !== action.payload),
        total: state.total - 1,
      };
    default:
      return state;
  }
}
