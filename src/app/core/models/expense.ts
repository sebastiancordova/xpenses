import { Base } from "./base";

export interface Expense extends Base {
  title: string;
  amount: string;
  category: ExpenseCategory,
  comment: string;
}

export enum ExpenseCategory {
  SUPERMARKET = "Supermercado",
  SUBSCRIPTIONS = "Subscripciones",
  TRANSPORT = "Transporte",
  HOUSE = "Casa",
  BILLS = "Cuentas",
  ENTERTAINMENT = "Entretenimiento",
  OTHERS = "Otros",
  CLOTHING = "Ropa",
  SELFCARE = "Auto cuidado"
}

enum EntertainmentTypes {
  RESTAURANTS = "restaurants",
  PUBS = "pubs",
}
