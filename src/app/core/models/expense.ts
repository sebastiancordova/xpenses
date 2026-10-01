import { Base } from './base';

export interface FixedExpense extends Base {
  title: string;
  amount: string;
  paymentMethodId?: string;
}

export interface Expense extends FixedExpense {
  category: ExpenseCategory | string,
  /** Optional detail chosen after the main category (for example, Salidas → Cine). */
  subcategory?: string,
  comment: string;
}

export enum ExpenseCategory {
  Alimentacion = "Alimentación",
  Salidas = "Salidas",
  Subscripciones = "Subscripciones",
  Transporte = "Transporte",
  Hogar = "Hogar",
  "Servicios y cuentas" = "Servicios y cuentas",
  "Salud y cuidado" = "Salud y cuidado",
  "Compras personales" = "Compras personales",
  Educacion = "Educación",
  Viajes = "Viajes",
  Otros = "Otros",
  // Valores históricos: se mantienen para que los gastos ya guardados sigan mostrándose.
  Supermercado = "Supermercado",
  Casa = "Casa",
  Cuentas = "Cuentas",
  Entretenimiento = "Entretenimiento",
  Ropa = "Ropa",
  "Auto cuidado" = "Auto cuidado",
  "Gasto Fijo" = "Gasto Fijo"
}

export interface ExpenseCategoryOption {
  category: ExpenseCategory;
  icon: string;
  subcategories?: string[];
}

/** Ordered taxonomy used by the expense forms. Keep historical enum values out of this list. */
export const EXPENSE_CATEGORY_OPTIONS: ExpenseCategoryOption[] = [
  { category: ExpenseCategory.Alimentacion, icon: 'fa-basket-shopping', subcategories: ['Supermercado', 'Delivery', 'Panadería y café'] },
  { category: ExpenseCategory.Salidas, icon: 'fa-champagne-glasses', subcategories: ['Restaurantes', 'Bar y café', 'Cine', 'Eventos y espectáculos', 'Hobbies'] },
  { category: ExpenseCategory.Transporte, icon: 'fa-car', subcategories: ['Transporte público', 'Taxi y apps', 'Combustible', 'Estacionamiento'] },
  { category: ExpenseCategory.Hogar, icon: 'fa-house', subcategories: ['Arriendo o dividendo', 'Mantención', 'Muebles y decoración'] },
  { category: ExpenseCategory['Servicios y cuentas'], icon: 'fa-file-invoice', subcategories: ['Luz', 'Agua', 'Gas', 'Internet y telefonía'] },
  { category: ExpenseCategory['Salud y cuidado'], icon: 'fa-heart-pulse', subcategories: ['Salud', 'Farmacia', 'Cuidado personal'] },
  { category: ExpenseCategory['Compras personales'], icon: 'fa-bag-shopping', subcategories: ['Ropa y calzado', 'Tecnología', 'Regalos'] },
  { category: ExpenseCategory.Educacion, icon: 'fa-graduation-cap', subcategories: ['Cursos', 'Libros y materiales'] },
  { category: ExpenseCategory.Viajes, icon: 'fa-plane', subcategories: ['Alojamiento', 'Pasajes', 'Actividades'] },
  { category: ExpenseCategory.Subscripciones, icon: 'fa-tv', subcategories: ['Streaming', 'Apps y software', 'Membresías'] },
  { category: ExpenseCategory.Otros, icon: 'fa-tag' },
];
