import { getCollection, setCollection } from "@/services/firebase/db";
import type { FinanceMovement, FinanceStatus } from "@/lib/finance/types";
import { getMonthKey } from "@/lib/finance/utils";

const MOVEMENTS_COLLECTION = "finance_movements";

export function listFinanceMovements() {
  return getCollection<FinanceMovement>(MOVEMENTS_COLLECTION, []);
}

export function createIncomeMovement(input: Omit<FinanceMovement, "id" | "monthKey" | "createdAt" | "updatedAt" | "type" | "concept">) {
  const now = new Date();
  const movement: FinanceMovement = {
    id: `mov_${Date.now()}`,
    type: "income",
    concept: input.clientName,
    clientName: input.clientName,
    projectService: input.projectService ?? null,
    amount: input.amount,
    incomeDate: input.incomeDate,
    expectedPayDate: input.expectedPayDate ?? null,
    accountDestination: input.accountDestination,
    responsible: input.responsible,
    status: input.status,
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    monthKey: getMonthKey(new Date(input.incomeDate)),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const movements = listFinanceMovements();
  const next = [movement, ...movements];
  setCollection(MOVEMENTS_COLLECTION, next);
  return movement;
}

export function updateFinanceMovementStatus(id: string, status: FinanceStatus) {
  const movements = listFinanceMovements();
  const index = movements.findIndex((movement) => movement.id === id);
  if (index === -1) return movements;
  movements[index] = { ...movements[index], status, updatedAt: new Date().toISOString() };
  setCollection(MOVEMENTS_COLLECTION, movements);
  return movements;
}

export function deleteFinanceMovement(id: string) {
  const movements = listFinanceMovements();
  const next = movements.filter((movement) => movement.id !== id);
  setCollection(MOVEMENTS_COLLECTION, next);
  return next;
}
