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

export function deleteFinanceMovement(id: string) {
  const movements = listFinanceMovements();
  const next = movements.filter((movement) => movement.id !== id);
  saveFinanceMovements(next);
  return next;
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
  const seedMonthKey = "2026-01";
  const now = new Date("2026-01-01T08:00:00.000Z");

  if (listFinanceAccounts().length === 0) {
    const accounts: FinanceAccount[] = [
      { id: "LUIS", name: "Cuenta Luis", currency: "PEN", initialBalance: 696, active: true },
      { id: "ALONDRA", name: "Cuenta Alondra", currency: "PEN", initialBalance: 0, active: true },
      { id: "KIMCE", name: "Caja Kimce", currency: "PEN", initialBalance: 0, active: true },
    ];
    saveFinanceAccounts(accounts);
  }

  if (listFinanceCategories().length === 0) {
    const categories: FinanceCategory[] = [
      { id: "general", label: "General", type: "all" },
      { id: "ventas", label: "Ventas", type: "income" },
      { id: "membresias", label: "Membresías", type: "income" },
      { id: "marketing", label: "Marketing", type: "income" },
      { id: "operativos", label: "Operativos", type: "expense" },
      { id: "personal", label: "Personal", type: "expense" },
      { id: "sunat", label: "SUNAT", type: "expense" },
    ];
    saveFinanceCategories(categories);
  }

  if (listFinanceClients().length === 0) {
    const clients: FinanceClient[] = [
      { id: "client-belcorp", name: "Belcorp", isRecurring: false, recurringAmount: 6000, recurringDay: 17, defaultAccountTo: "LUIS", active: true },
      { id: "client-comunidad", name: "15 - OCT - 15 NOV", isRecurring: false, recurringAmount: 2750, recurringDay: 17, defaultAccountTo: "LUIS", active: true },
      { id: "client-gotza", name: "Gotza", isRecurring: false, recurringAmount: 1200, recurringDay: 23, defaultAccountTo: "LUIS", active: true },
      { id: "client-valentino", name: "Valentino", isRecurring: false, recurringAmount: 1200, recurringDay: 1, defaultAccountTo: "LUIS", active: true },
    ];
    saveFinanceClients(clients);
  }

  if (listFinanceCollaborators().length === 0) {
    const collaborators: FinanceCollaborator[] = [
      { id: "collab-luis", displayName: "Luis", role: "Audiovisual", active: true },
      { id: "collab-alondra", displayName: "Alondra", role: "Marketing", active: true },
      { id: "collab-ariana", displayName: "Ariana", role: "Diseño", active: true },
      { id: "collab-audiovisual", displayName: "Audiovisual", role: "Producción", active: true },
      { id: "collab-cm", displayName: "CM", role: "Community", active: true },
    ];
    saveFinanceCollaborators(collaborators);
  }

  if (listFinanceContracts().length === 0) {
    const contracts: FinanceContract[] = [
      { id: "contract-luis", collaboratorId: "collab-luis", collaboratorName: "Luis", amount: 3400, frequency: "mensual", payDay: 15, startDate: now.toISOString(), defaultAccountFrom: "LUIS", active: true },
      { id: "contract-alondra", collaboratorId: "collab-alondra", collaboratorName: "Alondra", amount: 2440, frequency: "mensual", payDay: 15, startDate: now.toISOString(), defaultAccountFrom: "LUIS", active: true },
      { id: "contract-ariana", collaboratorId: "collab-ariana", collaboratorName: "Ariana", amount: 1500, frequency: "mensual", payDay: 15, startDate: now.toISOString(), defaultAccountFrom: "LUIS", active: true },
      { id: "contract-audiovisual", collaboratorId: "collab-audiovisual", collaboratorName: "Audiovisual", amount: 1700, frequency: "mensual", payDay: 15, startDate: now.toISOString(), defaultAccountFrom: "LUIS", active: true },
      { id: "contract-cm", collaboratorId: "collab-cm", collaboratorName: "CM", amount: 1300, frequency: "mensual", payDay: 15, startDate: now.toISOString(), defaultAccountFrom: "LUIS", active: true },
    ];
    saveFinanceContracts(contracts);
  }

  const existing = listFinanceMovements();
  if (existing.length > 0) return;

  const demo: FinanceMovement[] = [
    {
      id: "mov-1001",
      date: new Date("2026-01-17T08:00:00.000Z").toISOString(),
      monthKey: seedMonthKey,
      type: "Ingreso",
      status: "Cancelado",
      amount: 6000,
      currency: "PEN",
      accountTo: "LUIS",
      responsible: "LUIS",
      category: "Marketing",
      clientId: "client-belcorp",
      clientName: "Belcorp",
      concept: "Belcorp",
      referenceCode: "REF-ING-001",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-1002",
      date: new Date("2026-01-17T09:00:00.000Z").toISOString(),
      monthKey: seedMonthKey,
      type: "Ingreso",
      status: "Cancelado",
      amount: 2750,
      currency: "PEN",
      accountTo: "LUIS",
      responsible: "KIMCE",
      category: "Comunidad",
      clientId: "client-comunidad",
      clientName: "15 - OCT - 15 NOV",
      concept: "15 - OCT - 15 NOV",
      referenceCode: "REF-ING-002",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-1003",
      date: new Date("2026-01-23T09:00:00.000Z").toISOString(),
      monthKey: seedMonthKey,
      type: "Ingreso",
      status: "Cancelado",
      amount: 1200,
      currency: "PEN",
      accountTo: "LUIS",
      responsible: "ALONDRA",
      category: "General",
      clientId: "client-gotza",
      clientName: "Gotza",
      concept: "Gotza",
      referenceCode: "REF-ING-003",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-1004",
      date: new Date("2026-01-01T09:00:00.000Z").toISOString(),
      monthKey: seedMonthKey,
      type: "Ingreso",
      status: "Cancelado",
      amount: 1200,
      currency: "PEN",
      accountTo: "LUIS",
      responsible: "KIMCE",
      category: "General",
      clientId: "client-valentino",
      clientName: "Valentino",
      concept: "Valentino",
      referenceCode: "REF-ING-004",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-2001",
      date: new Date("2026-01-15T10:00:00.000Z").toISOString(),
      monthKey: seedMonthKey,
      type: "PagoColaborador",
      status: "Cancelado",
      amount: 3400,
      currency: "PEN",
      accountFrom: "LUIS",
      responsible: "Luis",
      category: "Personal",
      concept: "Audiovisual",
      referenceCode: "PAGO-LUIS",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-2002",
      date: new Date("2026-01-15T10:00:00.000Z").toISOString(),
      monthKey: seedMonthKey,
      type: "PagoColaborador",
      status: "Cancelado",
      amount: 2440,
      currency: "PEN",
      accountFrom: "LUIS",
      responsible: "Alondra",
      category: "Personal",
      concept: "Marketing",
      referenceCode: "PAGO-ALONDRA",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-2003",
      date: new Date("2026-01-15T10:00:00.000Z").toISOString(),
      monthKey: seedMonthKey,
      type: "PagoColaborador",
      status: "Cancelado",
      amount: 1500,
      currency: "PEN",
      accountFrom: "LUIS",
      responsible: "Ariana",
      category: "Personal",
      concept: "Diseño",
      referenceCode: "PAGO-ARIANA",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-2004",
      date: new Date("2026-01-15T10:00:00.000Z").toISOString(),
      monthKey: seedMonthKey,
      type: "PagoColaborador",
      status: "Cancelado",
      amount: 1700,
      currency: "PEN",
      accountFrom: "LUIS",
      responsible: "Audiovisual",
      category: "Personal",
      concept: "Producción",
      referenceCode: "PAGO-AUDIOVISUAL",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-2005",
      date: new Date("2026-01-15T10:00:00.000Z").toISOString(),
      monthKey: seedMonthKey,
      type: "PagoColaborador",
      status: "Cancelado",
      amount: 1300,
      currency: "PEN",
      accountFrom: "LUIS",
      responsible: "CM",
      category: "Personal",
      concept: "Community",
      referenceCode: "PAGO-CM",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-3001",
      date: new Date("2026-01-05T09:00:00.000Z").toISOString(),
      monthKey: seedMonthKey,
      type: "GastoFijo",
      status: "Cancelado",
      amount: 80,
      currency: "PEN",
      accountFrom: "LUIS",
      responsible: "LUIS",
      category: "GPT",
      concept: "Suscripción",
      referenceCode: "GASTO-GPT",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-4001",
      date: new Date("2026-01-20T09:00:00.000Z").toISOString(),
      monthKey: seedMonthKey,
      type: "GastoFijo",
      status: "Cancelado",
      amount: 700,
      currency: "PEN",
      accountFrom: "LUIS",
      responsible: "LUIS",
      category: "SUNAT",
      concept: "SUNAT",
      referenceCode: "SUNAT-ENERO",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mov-5001",
      date: new Date("2026-01-10T09:00:00.000Z").toISOString(),
      monthKey: seedMonthKey,
      type: "Fondo",
      status: "Cancelado",
      amount: 1200,
      currency: "PEN",
      accountTo: "ALONDRA",
      responsible: "ALONDRA",
      category: "Fondo",
      concept: "Fondo ALONDRA",
      referenceCode: "FONDO-ALONDRA",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  saveFinanceMovements(demo);
}
