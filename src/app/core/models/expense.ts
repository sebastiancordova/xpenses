import { Base } from "./base";

export interface Expense extends Base {
  title: string;
  amount: string;
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
