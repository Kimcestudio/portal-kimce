export type FinanceTransactionType =
  | "income"
  | "expense"
  | "collaborator_payment"
  | "transfer"
  | "refund"
  | "tax";

export type FinanceTransactionStatus = "pending" | "paid";

export type FinanceAccountName = "LUIS" | "ALONDRA" | "KIMCE";

export interface FinanceTransaction {
  id: string;
  date: string;
  type: FinanceTransactionType;
  category: string;
  client?: string;
  projectService?: string;
  amount: number;
  bonus?: number;
  discount?: number;
  refund?: number;
  finalAmount: number;
  responsible: string;
  accountFrom?: FinanceAccountName;
  accountTo?: FinanceAccountName;
  status: FinanceTransactionStatus;
  paidAt?: string;
  referenceId: string;
  notes?: string;
  receiptUrl?: string;
  monthKey: string;
}

export interface FinanceAccount {
  id: FinanceAccountName;
  name: string;
  currency: "PEN";
  initialBalance: number;
  active: boolean;
}

export interface FinanceMonthClosure {
  monthKey: string;
  closedBy: string;
  closedAt: string;
  notes?: string;
  locked: boolean;
}

export interface FinanceCategory {
  id: string;
  label: string;
  type: FinanceTransactionType | "all";
}

export type FinanceTabKey =
  | "dashboard"
  | "movimientos"
  | "pagos"
  | "gastos"
  | "cuentas"
  | "cierre";

export type FinanceFilters = {
  monthKey: string;
  status: "all" | FinanceTransactionStatus;
  account: "all" | FinanceAccountName;
  responsible: "all" | string;
  category: "all" | string;
};
