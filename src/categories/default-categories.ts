import { CategoryType } from './enums/category-type.enum';

/** Categorías que se crean para cada usuario al registrarse. */
export const DEFAULT_CATEGORIES: ReadonlyArray<{
  name: string;
  type: CategoryType;
}> = [
  ...[
    'Alimentación',
    'Transporte',
    'Vivienda',
    'Servicios',
    'Salud',
    'Educación',
    'Entretenimiento',
    'Ropa',
    'Otros gastos',
  ].map((name) => ({ name, type: CategoryType.EXPENSE })),
  ...['Salario', 'Freelance', 'Inversiones', 'Otros ingresos'].map((name) => ({
    name,
    type: CategoryType.INCOME,
  })),
];
