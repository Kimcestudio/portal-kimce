import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import type {
  Collaborator,
  CollaboratorPayment,
  Expense,
  FinanceMovement,
  FinanceStatus,
  TransferMovement,
} from "@/lib/finance/types";
import { financeRefs } from "@/lib/finance/refs";
import { formatDateOnly, getMonthKeyFromDate, getMonthKey } from "@/lib/finance/utils";

type FinanceUnsubscribe = () => void;

export async function listCollaborators() {
  const snapshot = await getDocs(financeRefs.collaboratorsRef);
  return snapshot.docs.map((item) => {
    const { id: _ignored, ...data } = item.data();
    return {
      ...data,
      id: item.id,
    };
  });
}

export function subscribeCollaborators(onChange: (items: Collaborator[]) => void): FinanceUnsubscribe {
  const collaboratorsQuery = query(financeRefs.collaboratorsRef, orderBy("createdAt", "desc"));
  return onSnapshot(collaboratorsQuery, (snapshot) => {
    const items = snapshot.docs.map((item) => {
      const { id: _ignored, ...data } = item.data();
      return {
        ...data,
        id: item.id,
      };
    });
    onChange(items);
  });
}

export function subscribeFinanceMovements(onChange: (items: FinanceMovement[]) => void): FinanceUnsubscribe {
  const movementsQuery = query(financeRefs.incomesRef, orderBy("createdAt", "desc"));
  return onSnapshot(movementsQuery, (snapshot) => {
    const items = snapshot.docs.map((item) => {
      const { id: _ignored, ...data } = item.data();
      return normalizeMovement({ ...data, id: item.id });
    });
    onChange(items);
  });
}

export function subscribeExpenses(onChange: (items: Expense[]) => void): FinanceUnsubscribe {
  const expensesQuery = query(financeRefs.expensesRef, orderBy("createdAt", "desc"));
  return onSnapshot(expensesQuery, (snapshot) => {
    const items = snapshot.docs.map((item) => {
      const { id: _ignored, ...data } = item.data();
      return normalizeExpense({ ...data, id: item.id });
    });
    onChange(items);
  });
}

export function subscribeTransfers(onChange: (items: TransferMovement[]) => void): FinanceUnsubscribe {
  const transfersQuery = query(financeRefs.transfersRef, orderBy("createdAt", "desc"));
  return onSnapshot(transfersQuery, (snapshot) => {
    const items = snapshot.docs.map((item) => {
      const { id: _ignored, ...data } = item.data();
      return normalizeTransfer({ ...data, id: item.id });
    });
    onChange(items);
  });
}

export function subscribeCollaboratorPayments(
  onChange: (items: CollaboratorPayment[]) => void,
): FinanceUnsubscribe {
  const paymentsQuery = query(financeRefs.collaboratorPaymentsRef, orderBy("createdAt", "desc"));
  return onSnapshot(paymentsQuery, (snapshot) => {
    const items = snapshot.docs.map((item) => {
      const { id: _ignored, ...data } = item.data();
      return normalizeCollaboratorPayment({ ...data, id: item.id });
    });
    onChange(items);
  });
}

export async function createIncomeMovement(
  input: Omit<FinanceMovement, "id" | "monthKey" | "createdAt" | "updatedAt" | "type" | "concept">,
) {
  const now = new Date();
  const incomeDate = formatDateOnly(input.incomeDate) ?? formatDateOnly(now) ?? "";
  const expectedPayDate = input.expectedPayDate
    ? formatDateOnly(input.expectedPayDate) ?? input.expectedPayDate
    : null;
  const totalAmount = input.tax?.total ?? input.amount;
  const movement: Omit<FinanceMovement, "id"> = {
    type: "income",
    concept: input.clientName,
    clientName: input.clientName,
    projectService: input.projectService ?? null,
    amount: totalAmount,
    incomeDate,
    expectedPayDate,
    accountDestination: input.accountDestination,
    status: normalizeStatus(input.status),
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    tax: input.tax,
    recurring: input.recurring,
    monthKey: getMonthKeyFromDate(incomeDate) ?? getMonthKey(new Date()),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const docRef = await addDoc(financeRefs.incomesRef, movement);
  return { ...movement, id: docRef.id };
}

export async function createCollaborator(input: Omit<Collaborator, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const collaborator: Omit<Collaborator, "id"> = {
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const docRef = await addDoc(financeRefs.collaboratorsRef, collaborator);
  return { ...collaborator, id: docRef.id };
}

export async function createCollaboratorPayment(
  input: Omit<CollaboratorPayment, "id" | "createdAt" | "updatedAt">,
) {
  const now = new Date().toISOString();
  const dateOnly = formatDateOnly(input.fechaPago) ?? formatDateOnly(new Date()) ?? "";
  const payment: Omit<CollaboratorPayment, "id"> = {
    ...input,
    fechaPago: dateOnly,
    status: normalizeStatus(input.status),
    createdAt: now,
    updatedAt: now,
  };
  const docRef = await addDoc(financeRefs.collaboratorPaymentsRef, payment);
  return { ...payment, id: docRef.id };
}

export async function createExpense(input: Omit<Expense, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const dateOnly = formatDateOnly(input.fechaGasto) ?? formatDateOnly(new Date()) ?? "";
  const expense: Omit<Expense, "id"> = {
    ...input,
    fechaGasto: dateOnly,
    status: normalizeStatus(input.status),
    createdAt: now,
    updatedAt: now,
  };
  const docRef = await addDoc(financeRefs.expensesRef, expense);
  return { ...expense, id: docRef.id };
}

export async function createTransfer(input: Omit<TransferMovement, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const dateOnly = formatDateOnly(input.fecha) ?? formatDateOnly(new Date()) ?? "";
  const transfer: Omit<TransferMovement, "id"> = {
    ...input,
    fecha: dateOnly,
    status: normalizeStatus(input.status),
    createdAt: now,
    updatedAt: now,
  };
  const docRef = await addDoc(financeRefs.transfersRef, transfer);
  return { ...transfer, id: docRef.id };
}

export async function updateFinanceMovementStatus(id: string, status: FinanceStatus) {
  await updateDoc(doc(financeRefs.movementsRef, id), {
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateExpenseStatus(id: string, status: FinanceStatus) {
  await updateDoc(doc(financeRefs.expensesRef, id), {
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateTransferStatus(id: string, status: FinanceStatus) {
  await updateDoc(doc(financeRefs.transfersRef, id), {
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateCollaboratorPaymentStatus(id: string, status: FinanceStatus) {
  await updateDoc(doc(financeRefs.collaboratorPaymentsRef, id), {
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateIncomeMovement(
  id: string,
  updates: Partial<Omit<FinanceMovement, "id" | "type" | "createdAt" | "monthKey">>,
) {
  const nextUpdates = normalizeMovementUpdates(updates);
  const cleanedUpdates = Object.fromEntries(
    Object.entries(nextUpdates).filter(([, value]) => value !== undefined),
  );
  await updateDoc(doc(financeRefs.movementsRef, id), {
    ...cleanedUpdates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteFinanceMovement(id: string) {
  await deleteDoc(doc(financeRefs.movementsRef, id));
}

function normalizeStatus(value: unknown): FinanceStatus {
  if (value === "pending" || value === "cancelled") {
    return value;
  }
  if (value === "PENDIENTE") return "pending";
  if (value === "CANCELADO") return "cancelled";
  if (value === "PAGADO" || value === "PAGADA") return "pending";
  return "pending";
}

function normalizeMovementUpdates(
  updates: Partial<Omit<FinanceMovement, "id" | "type" | "createdAt" | "monthKey">>,
) {
  const incomeDate = updates.incomeDate ? formatDateOnly(updates.incomeDate) ?? updates.incomeDate : undefined;
  const expectedPayDate =
    updates.expectedPayDate !== undefined && updates.expectedPayDate !== null
      ? formatDateOnly(updates.expectedPayDate) ?? updates.expectedPayDate
      : updates.expectedPayDate;
  return {
    ...updates,
    incomeDate,
    expectedPayDate,
    status: updates.status ? normalizeStatus(updates.status) : undefined,
    monthKey: incomeDate ? getMonthKeyFromDate(incomeDate) ?? undefined : undefined,
  };
}

function normalizeMovement(movement: FinanceMovement) {
  const incomeDate = formatDateOnly(movement.incomeDate) ?? movement.incomeDate;
  const expectedPayDate = movement.expectedPayDate
    ? formatDateOnly(movement.expectedPayDate) ?? movement.expectedPayDate
    : null;
  return {
    ...movement,
    incomeDate,
    expectedPayDate,
    status: normalizeStatus(movement.status),
    monthKey: getMonthKeyFromDate(incomeDate) ?? movement.monthKey,
  };
}

function normalizeExpense(expense: Expense & { estado?: FinanceStatus }) {
  const fechaGasto = formatDateOnly(expense.fechaGasto) ?? expense.fechaGasto;
  const status = normalizeStatus(expense.status ?? expense.estado);
  return {
    ...expense,
    fechaGasto,
    status,
  };
}

function normalizeTransfer(transfer: TransferMovement) {
  const fecha = formatDateOnly(transfer.fecha) ?? transfer.fecha;
  return {
    ...transfer,
    fecha,
    status: normalizeStatus(transfer.status),
  };
}

function normalizeCollaboratorPayment(payment: CollaboratorPayment & { estado?: FinanceStatus }) {
  const fechaPago = formatDateOnly(payment.fechaPago) ?? payment.fechaPago;
  const status = normalizeStatus(payment.status ?? payment.estado);
  return {
    ...payment,
    fechaPago,
    status,
  };
}
