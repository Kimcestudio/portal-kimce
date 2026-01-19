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
  collaboratorId?: string;
  expenseKind?: "fixed" | "variable";
}

export interface FinanceAccount {
  id: FinanceAccountName;
  name: string;
  currency: "PEN";
  initialBalance: number;
  active: boolean;
}

export interface FinanceMonthSnapshot {
  monthKey: string;
  incomePaid: number;
  expensesPaid: number;
  netIncome: number;
}

export interface FinanceMonthClosure {
  monthKey: string;
  closedBy: string;
  closedAt: string;
  notes?: string;
  locked: boolean;
  snapshot: FinanceMonthSnapshot;
}

export interface FinanceCategory {
  id: string;
  label: string;
  type: FinanceTransactionType | "all";
}

export interface FinanceClient {
  id: string;
  name: string;
  type: "retainer" | "project" | "internal";
  agreedAmount: number;
  frequency: "one_off" | "monthly" | "milestone";
  expectedDate: string;
  status: "active" | "closed";
}

export interface FinanceCollaborator {
  id: string;
  name: string;
  role: string;
  contractType: "fixed" | "freelance";
  paymentAmount: number;
  frequency: "monthly" | "per_project";
  paymentDate: string;
  contractEnd?: string;
  status: "active" | "inactive";
}

export interface FinanceExpensePlan {
  id: string;
  label: string;
  category: string;
  account: FinanceAccountName;
  responsible: string;
  frequency: "one_off" | "monthly";
  impactCash: boolean;
  status: "pending" | "paid";
  amount: number;
  expenseKind: "fixed" | "variable";
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
