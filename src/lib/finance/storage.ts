import { getCollection, setCollection } from "@/services/firebase/db";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceClient,
  FinanceCollaborator,
  FinanceContract,
  FinanceMonthClosure,
  FinanceMovement,
  FinanceMovementStatus,
} from "@/lib/finance/types";
import { getMonthKey } from "@/lib/finance/utils";

const MOVEMENTS_COLLECTION = "finance_movements";
const ACCOUNTS_COLLECTION = "finance_accounts";
const CATEGORIES_COLLECTION = "finance_categories";
const MONTH_CLOSURE_COLLECTION = "finance_month_closures";
const CLIENTS_COLLECTION = "finance_clients";
const COLLABORATORS_COLLECTION = "finance_collaborators";
const CONTRACTS_COLLECTION = "finance_contracts";

export function listFinanceMovements() {
  return getCollection<FinanceMovement>(MOVEMENTS_COLLECTION, []);
}

export function listFinanceAccounts() {
  return getCollection<FinanceAccount>(ACCOUNTS_COLLECTION, []);
}

export function listFinanceCategories() {
  return getCollection<FinanceCategory>(CATEGORIES_COLLECTION, []);
}

export function listMonthClosures() {
  return getCollection<FinanceMonthClosure>(MONTH_CLOSURE_COLLECTION, []);
}

export function listFinanceClients() {
  return getCollection<FinanceClient>(CLIENTS_COLLECTION, []);
}

export function listFinanceCollaborators() {
  return getCollection<FinanceCollaborator>(COLLABORATORS_COLLECTION, []);
}

export function listFinanceContracts() {
  return getCollection<FinanceContract>(CONTRACTS_COLLECTION, []);
}

export function saveFinanceMovements(movements: FinanceMovement[]) {
  setCollection(MOVEMENTS_COLLECTION, movements);
}

export function saveFinanceAccounts(accounts: FinanceAccount[]) {
  setCollection(ACCOUNTS_COLLECTION, accounts);
}

export function saveFinanceCategories(categories: FinanceCategory[]) {
  setCollection(CATEGORIES_COLLECTION, categories);
}

export function saveMonthClosures(closures: FinanceMonthClosure[]) {
  setCollection(MONTH_CLOSURE_COLLECTION, closures);
}

export function saveFinanceClients(clients: FinanceClient[]) {
  setCollection(CLIENTS_COLLECTION, clients);
}

export function saveFinanceCollaborators(collaborators: FinanceCollaborator[]) {
  setCollection(COLLABORATORS_COLLECTION, collaborators);
}

export function saveFinanceContracts(contracts: FinanceContract[]) {
  setCollection(CONTRACTS_COLLECTION, contracts);
}

export function generateReferenceId() {
  return `REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString(36)}`;
}

export function createFinanceMovement(input: Partial<FinanceMovement>) {
  const movements = listFinanceMovements();
  const now = new Date();
  const date = input.date ?? now.toISOString();
  const movement: FinanceMovement = {
    id: input.id ?? `mov_${Date.now()}`,
    date,
    monthKey: input.monthKey ?? getMonthKey(new Date(date)),
    type: input.type ?? "GastoVariable",
    status: (input.status as FinanceMovementStatus) ?? "Pendiente",
    amount: input.amount ?? 0,
    currency: "PEN",
    accountFrom: input.accountFrom,
    accountTo: input.accountTo,
    responsible: input.responsible ?? "Sin asignar",
    category: input.category ?? "General",
    clientId: input.clientId,
    clientName: input.clientName,
    concept: input.concept ?? input.clientName ?? "Sin concepto",
    referenceCode: input.referenceCode,
    createdAt: input.createdAt ?? now.toISOString(),
    updatedAt: input.updatedAt ?? now.toISOString(),
  };

  const duplicates = findPossibleDuplicates(movement, movements);
  return { movement, duplicates };
}

export function addFinanceMovement(movement: FinanceMovement) {
  const movements = listFinanceMovements();
  const next = [movement, ...movements];
  saveFinanceMovements(next);
  return next;
}

export function updateFinanceMovementStatus(id: string, status: FinanceMovementStatus) {
  const movements = listFinanceMovements();
  const index = movements.findIndex((movement) => movement.id === id);
  if (index === -1) return movements;
  movements[index] = { ...movements[index], status, updatedAt: new Date().toISOString() };
  saveFinanceMovements(movements);
  return movements;
}

export function findPossibleDuplicates(
  candidate: Pick<FinanceMovement, "date" | "type" | "amount" | "accountFrom" | "accountTo" | "referenceCode">,
  movements: FinanceMovement[] = listFinanceMovements()
) {
  const targetDate = new Date(candidate.date).toISOString().slice(0, 10);
  return movements.filter((movement) => {
    const dateMatch = movement.date.slice(0, 10) === targetDate;
    const amountMatch = Math.abs(movement.amount - candidate.amount) < 0.01;
    const typeMatch = movement.type === candidate.type;
    const accountMatch = movement.accountFrom === candidate.accountFrom && movement.accountTo === candidate.accountTo;
    const referenceMatch = candidate.referenceCode ? movement.referenceCode === candidate.referenceCode : true;
    return dateMatch && amountMatch && typeMatch && accountMatch && referenceMatch;
  });
}

export function closeFinanceMonth(closure: FinanceMonthClosure) {
  const closures = listMonthClosures();
  const next = [closure, ...closures.filter((item) => item.monthKey !== closure.monthKey)];
  saveMonthClosures(next);
  return next;
}

export function seedFinanceData() {
  const now = new Date();
  const monthKey = getMonthKey(now);

  if (listFinanceAccounts().length === 0) {
    const accounts: FinanceAccount[] = [
      { id: "LUIS", name: "Cuenta Luis", currency: "PEN", initialBalance: 14000, active: true },
      { id: "ALONDRA", name: "Cuenta Alondra", currency: "PEN", initialBalance: 9800, active: true },
      { id: "KIMCE", name: "Caja Kimce", currency: "PEN", initialBalance: 5200, active: true },
    ];
    saveFinanceAccounts(accounts);
  }

  if (listFinanceCategories().length === 0) {
    const categories: FinanceCategory[] = [
      { id: "general", label: "General", type: "all" },
      { id: "ventas", label: "Ventas", type: "income" },
      { id: "membresias", label: "Membresías", type: "income" },
      { id: "servicios", label: "Servicios", type: "income" },
      { id: "personal", label: "Personal", type: "expense" },
      { id: "operativos", label: "Operativos", type: "expense" },
      { id: "marketing", label: "Marketing", type: "expense" },
      { id: "sunat", label: "SUNAT", type: "expense" },
    ];
    saveFinanceCategories(categories);
  }

  if (listFinanceClients().length === 0) {
    const clients: FinanceClient[] = [
      {
        id: "client-1",
        name: "Clínica San Pablo",
        isRecurring: true,
        recurringAmount: 8200,
        recurringDay: 5,
        defaultAccountTo: "LUIS",
        active: true,
      },
      {
        id: "client-2",
        name: "Innova Dental",
        isRecurring: false,
        recurringAmount: 5400,
        recurringDay: 18,
        defaultAccountTo: "KIMCE",
        active: true,
      },
    ];
    saveFinanceClients(clients);
  }

  if (listFinanceCollaborators().length === 0) {
    const collaborators: FinanceCollaborator[] = [
      { id: "collab-1", displayName: "Alondra Ruiz", role: "UX Designer", active: true },
      { id: "collab-2", displayName: "Diego Rivera", role: "Project Manager", active: true },
    ];
    saveFinanceCollaborators(collaborators);
  }

  if (listFinanceContracts().length === 0) {
    const contracts: FinanceContract[] = [
      {
        id: "contract-1",
        collaboratorId: "collab-1",
        collaboratorName: "Alondra Ruiz",
        amount: 2200,
        frequency: "mensual",
        payDay: 10,
        startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        defaultAccountFrom: "ALONDRA",
        active: true,
      },
      {
        id: "contract-2",
        collaboratorId: "collab-2",
        collaboratorName: "Diego Rivera",
        amount: 3200,
        frequency: "mensual",
        payDay: 14,
        startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        defaultAccountFrom: "LUIS",
        active: true,
      },
    ];
    saveFinanceContracts(contracts);
  }

  const existing = listFinanceMovements();
  if (existing.length > 0) return;

  const demo: FinanceMovement[] = [
    {
      id: "mov-1001",
      date: new Date(now.getFullYear(), now.getMonth(), 2).toISOString(),
      monthKey,
      type: "Ingreso",
      status: "Cancelado",
      amount: 8200,
      currency: "PEN",
      accountTo: "LUIS",
      responsible: "Luis",
      category: "Ventas",
      clientId: "client-1",
      clientName: "Clínica San Pablo",
      concept: "Clínica San Pablo",
      referenceCode: "REF-VENTA-001",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-1002",
      date: new Date(now.getFullYear(), now.getMonth(), 4).toISOString(),
      monthKey,
      type: "Ingreso",
      status: "Pendiente",
      amount: 3600,
      currency: "PEN",
      accountTo: "KIMCE",
      responsible: "Alondra",
      category: "Membresías",
      clientId: "client-2",
      clientName: "Innova Dental",
      concept: "Innova Dental",
      referenceCode: "REF-MEMB-002",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-1003",
      date: new Date(now.getFullYear(), now.getMonth(), 6).toISOString(),
      monthKey,
      type: "GastoVariable",
      status: "Cancelado",
      amount: 1400,
      currency: "PEN",
      accountFrom: "LUIS",
      responsible: "Luis",
      category: "Operativos",
      concept: "Operativos",
      referenceCode: "REF-OP-003",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-1004",
      date: new Date(now.getFullYear(), now.getMonth(), 9).toISOString(),
      monthKey,
      type: "PagoColaborador",
      status: "Cancelado",
      amount: 2200,
      currency: "PEN",
      accountFrom: "ALONDRA",
      responsible: "Alondra",
      category: "Personal",
      concept: "Pago a Alondra Ruiz",
      referenceCode: "REF-PAGO-004",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-1005",
      date: new Date(now.getFullYear(), now.getMonth(), 12).toISOString(),
      monthKey,
      type: "GastoFijo",
      status: "Pendiente",
      amount: 680,
      currency: "PEN",
      accountFrom: "KIMCE",
      responsible: "Luis",
      category: "SUNAT",
      concept: "SUNAT",
      referenceCode: "REF-TAX-005",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-1006",
      date: new Date(now.getFullYear(), now.getMonth(), 14).toISOString(),
      monthKey,
      type: "Transferencia",
      status: "Cancelado",
      amount: 2500,
      currency: "PEN",
      accountFrom: "LUIS",
      accountTo: "KIMCE",
      responsible: "Luis",
      category: "Transferencias",
      concept: "Transferencia LUIS -> KIMCE",
      referenceCode: "REF-TR-006",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  saveFinanceMovements(demo);
}
