export type FinanceStatus = "PENDIENTE" | "CANCELADO";

export type FinanceAccountName = "LUIS" | "ALONDRA" | "KIMCE";

export type FinanceModalType =
  | "income"
  | "collaborator"
  | "collaborator_payment"
  | "expense"
  | "transfer";

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

export type CollaboratorPaymentType = "MENSUAL" | "POR_PROYECTO" | "POR_HORAS";

export interface Collaborator {
  id: string;
  nombreCompleto: string;
  rolPuesto: string;
  tipoPago: CollaboratorPaymentType;
  montoBase: number;
  moneda: "PEN";
  cuentaPagoPreferida: FinanceAccountName;
  diaPago?: number | null;
  fechaPago?: string | null;
  inicioContrato: string;
  finContrato?: string | null;
  activo: boolean;
  notas?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollaboratorPayment {
  id: string;
  colaboradorId: string;
  periodo: string;
  montoBase: number;
  bono?: number | null;
  descuento?: number | null;
  devolucion?: number | null;
  montoFinal: number;
  fechaPago: string;
  cuentaOrigen: FinanceAccountName;
  estado: FinanceStatus;
  referencia?: string | null;
  notas?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseType = "FIJO" | "VARIABLE";

export type ExpenseCategory =
  | "SUNAT"
  | "OPERATIVOS"
  | "HERRAMIENTAS"
  | "SERVICIOS"
  | "TRASLADO"
  | "OTROS";

export interface Expense {
  id: string;
  tipoGasto: ExpenseType;
  categoria: ExpenseCategory;
  descripcion: string;
  monto: number;
  fechaGasto: string;
  cuentaOrigen: FinanceAccountName;
  responsable: FinanceAccountName;
  estado: FinanceStatus;
  requiereDevolucion: boolean;
  devolucionMonto?: number | null;
  referencia?: string | null;
  notas?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TransferMovementType = "TRANSFERENCIA" | "INGRESO_CAJA" | "SALIDA_CAJA";

export interface TransferMovement {
  id: string;
  tipoMovimiento: TransferMovementType;
  cuentaOrigen?: FinanceAccountName | null;
  cuentaDestino?: FinanceAccountName | null;
  monto: number;
  fecha: string;
  responsable: FinanceAccountName;
  referencia?: string | null;
  notas?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FinanceFilters = {
  monthKey: string;
  status: "all" | FinanceStatus;
  account: "all" | FinanceAccountName;
  responsible: "all" | FinanceAccountName;
  category?: "all" | string;
};

export type FinanceTabKey = "dashboard" | "movimientos" | "pagos" | "gastos" | "cuentas" | "cierre";
