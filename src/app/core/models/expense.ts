import { Base } from './base';

export interface FixedExpense extends Base {
  title: string;
  amount: string;
}

export interface Expense extends FixedExpense {
  category: ExpenseCategory,
  comment: string;
}

export enum ExpenseCategory {
  Supermercado = "Supermercado",
  Subscripciones = "Subscripciones",
  Transporte = "Transporte",
  Casa = "Casa",
  Cuentas = "Cuentas",
  Entretenimiento = "Entretenimiento",
  Otros = "Otros",
  Ropa = "Ropa",
  "Auto cuidado" = "Auto cuidado"
}

enum EntertainmentTypes {
  Restaurants = "Restaurants",
  Pubs = "Pubs",
}
