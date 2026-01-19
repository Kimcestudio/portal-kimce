export type FinanceMovementType =
  | "Ingreso"
  | "PagoColaborador"
  | "GastoFijo"
  | "GastoVariable"
  | "Transferencia"
  | "Fondo";

export type FinanceMovementStatus = "Pendiente" | "Cancelado";

export type FinanceAccountName = "LUIS" | "ALONDRA" | "KIMCE";

export interface FinanceMovement {
  id: string;
  date: string;
  monthKey: string;
  type: FinanceMovementType;
  status: FinanceMovementStatus;
  amount: number;
  currency: "PEN";
  accountFrom?: FinanceAccountName;
  accountTo?: FinanceAccountName;
  responsible: string;
  category: string;
  clientId?: string;
  clientName?: string;
  concept: string;
  referenceCode?: string;
  createdAt: string;
  updatedAt: string;
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
  type: "income" | "expense" | "all";
}

export interface FinanceClient {
  id: string;
  name: string;
  isRecurring: boolean;
  recurringAmount: number;
  recurringDay: number;
  defaultAccountTo: FinanceAccountName;
  active: boolean;
}

export interface FinanceCollaborator {
  id: string;
  displayName: string;
  role: string;
  active: boolean;
}

export interface FinanceContract {
  id: string;
  collaboratorId: string;
  collaboratorName: string;
  amount: number;
  frequency: "mensual" | "quincenal" | "por_proyecto";
  payDay: number;
  startDate: string;
  endDate?: string;
  defaultAccountFrom: FinanceAccountName;
  active: boolean;
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
  status: "all" | FinanceMovementStatus;
  account: "all" | FinanceAccountName;
  responsible: "all" | string;
  category: "all" | string;
  type: "all" | FinanceMovementType;
};

export type ValidationReference = {
  ingresosRef: number;
  pagosRef: number;
  sunatRef: number;
  gastosRef: number;
};
