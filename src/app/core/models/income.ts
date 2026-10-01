import { Base } from "./base";

export interface Income extends Base {
  title: string;
  amount: string;
  /** Calendar month in YYYY-MM format. Older records fall back to createdAt. */
  period?: string;
  type?: 'fixed' | 'variable';
}
