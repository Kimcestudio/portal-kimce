import { getCollection, setCollection } from "@/services/firebase/db";
import type {
  Collaborator,
  CollaboratorPayment,
  Expense,
  FinanceMovement,
  FinanceStatus,
  TransferMovement,
} from "@/lib/finance/types";
import { formatDateOnly, getMonthKeyFromDate, getMonthKey } from "@/lib/finance/utils";

const MOVEMENTS_COLLECTION = "finance_movements";
const INCOMES_COLLECTION = "incomes";
const COLLABORATORS_COLLECTION = "collaborators";
const COLLABORATOR_PAYMENTS_COLLECTION = "collaboratorPayments";
const EXPENSES_COLLECTION = "expenses";
const TRANSFERS_COLLECTION = "transfers";

export function listFinanceMovements() {
  const movements = getCollection<FinanceMovement>(MOVEMENTS_COLLECTION, []);
  return movements.map((movement) => normalizeMovementDates(movement));
}

export function listCollaborators() {
  return getCollection<Collaborator>(COLLABORATORS_COLLECTION, []);
}

export function listCollaboratorPayments() {
  return getCollection<CollaboratorPayment>(COLLABORATOR_PAYMENTS_COLLECTION, []);
}

export function listExpenses() {
  const expenses = getCollection<Expense>(EXPENSES_COLLECTION, []);
  return expenses.map((expense) => normalizeExpenseDates(expense));
}

export function listTransfers() {
  return getCollection<TransferMovement>(TRANSFERS_COLLECTION, []);
}

export function createIncomeMovement(
  input: Omit<FinanceMovement, "id" | "monthKey" | "createdAt" | "updatedAt" | "type" | "concept">,
) {
  const now = new Date();
  const incomeDate = formatDateOnly(input.incomeDate) ?? formatDateOnly(now) ?? "";
  const expectedPayDate = input.expectedPayDate
    ? formatDateOnly(input.expectedPayDate) ?? input.expectedPayDate
    : null;
  const totalAmount = input.tax?.total ?? input.amount;
  const movement: FinanceMovement = {
    id: `mov_${Date.now()}`,
    type: "income",
    concept: input.clientName,
    clientName: input.clientName,
    projectService: input.projectService ?? null,
    amount: totalAmount,
    incomeDate,
    expectedPayDate,
    accountDestination: input.accountDestination,
    status: input.status,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    tax: input.tax,
    recurring: input.recurring,
    monthKey: getMonthKeyFromDate(incomeDate) ?? getMonthKey(new Date()),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const movements = listFinanceMovements();
  const next = [movement, ...movements];
  setCollection(MOVEMENTS_COLLECTION, next);
  const incomes = getCollection<FinanceMovement>(INCOMES_COLLECTION, []);
  setCollection(INCOMES_COLLECTION, [movement, ...incomes]);
  return movement;
}

export function createCollaborator(input: Omit<Collaborator, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const collaborator: Collaborator = {
    id: `collab_${Date.now()}`,
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const collaborators = listCollaborators();
  setCollection(COLLABORATORS_COLLECTION, [collaborator, ...collaborators]);
  return collaborator;
}

export function createCollaboratorPayment(
  input: Omit<CollaboratorPayment, "id" | "createdAt" | "updatedAt">,
) {
  const now = new Date().toISOString();
  const payment: CollaboratorPayment = {
    id: `collab_pay_${Date.now()}`,
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const payments = listCollaboratorPayments();
  setCollection(COLLABORATOR_PAYMENTS_COLLECTION, [payment, ...payments]);
  return payment;
}

export function createExpense(input: Omit<Expense, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const dateOnly = formatDateOnly(input.fechaGasto) ?? formatDateOnly(new Date()) ?? "";
  const expense: Expense = {
    id: `expense_${Date.now()}`,
    ...input,
    fechaGasto: dateOnly,
    createdAt: now,
    updatedAt: now,
  };
  const expenses = listExpenses();
  setCollection(EXPENSES_COLLECTION, [expense, ...expenses]);
  return expense;
}

export function createTransfer(input: Omit<TransferMovement, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const dateOnly = formatDateOnly(input.fecha) ?? formatDateOnly(new Date()) ?? "";
  const transfer: TransferMovement = {
    id: `transfer_${Date.now()}`,
    ...input,
    fecha: dateOnly,
    createdAt: now,
    updatedAt: now,
  };
  const transfers = listTransfers();
  setCollection(TRANSFERS_COLLECTION, [transfer, ...transfers]);
  return transfer;
}

export function updateFinanceMovementStatus(id: string, status: FinanceStatus) {
  const movements = listFinanceMovements();
  const index = movements.findIndex((movement) => movement.id === id);
  if (index === -1) return movements;
  movements[index] = { ...movements[index], status, updatedAt: new Date().toISOString() };
  setCollection(MOVEMENTS_COLLECTION, movements);
  return movements;
}

export function updateIncomeMovement(
  id: string,
  updates: Partial<Omit<FinanceMovement, "id" | "type" | "createdAt" | "monthKey">>,
) {
  const movements = listFinanceMovements();
  const index = movements.findIndex((movement) => movement.id === id);
  if (index === -1) return movements;
  const current = movements[index];
  const next = normalizeMovementDates({
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  movements[index] = next;
  setCollection(MOVEMENTS_COLLECTION, movements);
  const incomes = getCollection<FinanceMovement>(INCOMES_COLLECTION, []);
  const incomeIndex = incomes.findIndex((movement) => movement.id === id);
  if (incomeIndex !== -1) {
    incomes[incomeIndex] = next;
    setCollection(INCOMES_COLLECTION, incomes);
  }
  return movements;
}

function normalizeMovementDates(movement: FinanceMovement) {
  const incomeDate = formatDateOnly(movement.incomeDate) ?? movement.incomeDate;
  const expectedPayDate = movement.expectedPayDate
    ? formatDateOnly(movement.expectedPayDate) ?? movement.expectedPayDate
    : null;
  return {
    ...movement,
    incomeDate,
    expectedPayDate,
    monthKey: getMonthKeyFromDate(incomeDate) ?? movement.monthKey,
  };
}

function normalizeExpenseDates(expense: Expense) {
  const fechaGasto = formatDateOnly(expense.fechaGasto) ?? expense.fechaGasto;
  return {
    ...expense,
    fechaGasto,
  };
}

export function deleteFinanceMovement(id: string) {
  const movements = listFinanceMovements();
  const next = movements.filter((movement) => movement.id !== id);
  setCollection(MOVEMENTS_COLLECTION, next);
  return next;
}
