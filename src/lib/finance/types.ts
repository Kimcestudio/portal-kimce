export type FinanceStatus = "PENDIENTE" | "CANCELADO";

export type FinanceAccountName = "LUIS" | "ALONDRA" | "KIMCE";

export interface FinanceMovement {
  id: string;
  type: "income";
  concept: string;
  clientName: string;
  projectService?: string | null;
  amount: number;
  incomeDate: string;
  expectedPayDate?: string | null;
  accountDestination: FinanceAccountName;
  responsible: FinanceAccountName;
  status: FinanceStatus;
  reference?: string | null;
  notes?: string | null;
  monthKey: string;
  createdAt: string;
  updatedAt: string;
}

export type FinanceFilters = {
  monthKey: string;
  status: "all" | FinanceStatus;
  account: "all" | FinanceAccountName;
  responsible: "all" | FinanceAccountName;
};
