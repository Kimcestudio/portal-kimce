import { getCollection, setCollection } from "@/services/firebase/db";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceClient,
  FinanceCollaborator,
  FinanceExpensePlan,
  FinanceMonthClosure,
  FinanceTransaction,
  FinanceTransactionStatus,
} from "@/lib/finance/types";
import { calcFinalAmount, getMonthKey } from "@/lib/finance/utils";

const TRANSACTIONS_COLLECTION = "financeTransactions";
const ACCOUNTS_COLLECTION = "financeAccounts";
const CATEGORIES_COLLECTION = "financeCategories";
const MONTH_CLOSURE_COLLECTION = "financeMonthClosures";
const CLIENTS_COLLECTION = "financeClients";
const COLLABORATORS_COLLECTION = "financeCollaborators";
const EXPENSES_COLLECTION = "financeExpensePlans";

export function listFinanceTransactions() {
  return getCollection<FinanceTransaction>(TRANSACTIONS_COLLECTION, []);
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

export function listFinanceExpensePlans() {
  return getCollection<FinanceExpensePlan>(EXPENSES_COLLECTION, []);
}

export function saveFinanceTransactions(transactions: FinanceTransaction[]) {
  setCollection(TRANSACTIONS_COLLECTION, transactions);
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

export function saveFinanceExpensePlans(expenses: FinanceExpensePlan[]) {
  setCollection(EXPENSES_COLLECTION, expenses);
}

export function generateReferenceId() {
  return `REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString(36)}`;
}

export function createFinanceTransaction(input: Partial<FinanceTransaction>) {
  const transactions = listFinanceTransactions();
  const now = new Date();
  const date = input.date ?? now.toISOString();
  const transaction: FinanceTransaction = {
    id: input.id ?? `txn_${Date.now()}`,
    date,
    type: input.type ?? "expense",
    category: input.category ?? "General",
    client: input.client,
    projectService: input.projectService,
    amount: input.amount ?? 0,
    bonus: input.bonus,
    discount: input.discount,
    refund: input.refund,
    finalAmount: input.finalAmount ??
      calcFinalAmount({
        amount: input.amount ?? 0,
        bonus: input.bonus,
        discount: input.discount,
        refund: input.refund,
      }),
    responsible: input.responsible ?? "Sin asignar",
    accountFrom: input.accountFrom,
    accountTo: input.accountTo,
    status: (input.status as FinanceTransactionStatus) ?? "pending",
    paidAt: input.paidAt,
    referenceId: input.referenceId ?? generateReferenceId(),
    notes: input.notes,
    receiptUrl: input.receiptUrl,
    monthKey: input.monthKey ?? getMonthKey(new Date(date)),
    collaboratorId: input.collaboratorId,
    expenseKind: input.expenseKind,
  };

  const duplicates = findPossibleDuplicates(transaction, transactions);
  return { transaction, duplicates };
}

export function addFinanceTransaction(transaction: FinanceTransaction) {
  const transactions = listFinanceTransactions();
  const next = [transaction, ...transactions];
  saveFinanceTransactions(next);
  return next;
}

export function findPossibleDuplicates(
  candidate: Pick<FinanceTransaction, "date" | "type" | "finalAmount" | "accountFrom" | "accountTo" | "referenceId">,
  transactions: FinanceTransaction[] = listFinanceTransactions()
) {
  const targetDate = new Date(candidate.date).toISOString().slice(0, 10);
  return transactions.filter((transaction) => {
    const dateMatch = transaction.date.slice(0, 10) === targetDate;
    const amountMatch = Math.abs(transaction.finalAmount - candidate.finalAmount) < 0.01;
    const typeMatch = transaction.type === candidate.type;
    const accountMatch =
      transaction.accountFrom === candidate.accountFrom && transaction.accountTo === candidate.accountTo;
    const referenceMatch = candidate.referenceId
      ? transaction.referenceId === candidate.referenceId
      : true;
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
      { id: "personal", label: "Personal", type: "collaborator_payment" },
      { id: "operativos", label: "Operativos", type: "expense" },
      { id: "marketing", label: "Marketing", type: "expense" },
      { id: "sunat", label: "SUNAT", type: "tax" },
      { id: "transferencias", label: "Transferencias", type: "transfer" },
    ];
    saveFinanceCategories(categories);
  }

  if (listFinanceClients().length === 0) {
    const clients: FinanceClient[] = [
      {
        id: "client-1",
        name: "Clínica San Pablo",
        type: "retainer",
        agreedAmount: 8200,
        frequency: "monthly",
        expectedDate: new Date(now.getFullYear(), now.getMonth(), 5).toISOString(),
        status: "active",
      },
      {
        id: "client-2",
        name: "Innova Dental",
        type: "project",
        agreedAmount: 5400,
        frequency: "milestone",
        expectedDate: new Date(now.getFullYear(), now.getMonth(), 18).toISOString(),
        status: "active",
      },
    ];
    saveFinanceClients(clients);
  }

  if (listFinanceCollaborators().length === 0) {
    const collaborators: FinanceCollaborator[] = [
      {
        id: "collab-1",
        name: "Alondra Ruiz",
        role: "UX Designer",
        contractType: "freelance",
        paymentAmount: 2200,
        frequency: "monthly",
        paymentDate: new Date(now.getFullYear(), now.getMonth(), 10).toISOString(),
        status: "active",
      },
      {
        id: "collab-2",
        name: "Diego Rivera",
        role: "Project Manager",
        contractType: "fixed",
        paymentAmount: 3200,
        frequency: "monthly",
        paymentDate: new Date(now.getFullYear(), now.getMonth(), 14).toISOString(),
        status: "active",
      },
    ];
    saveFinanceCollaborators(collaborators);
  }

  if (listFinanceExpensePlans().length === 0) {
    const plans: FinanceExpensePlan[] = [
      {
        id: "expense-1",
        label: "SUNAT mensual",
        category: "SUNAT",
        account: "KIMCE",
        responsible: "Luis",
        frequency: "monthly",
        impactCash: true,
        status: "pending",
        amount: 680,
        expenseKind: "fixed",
      },
      {
        id: "expense-2",
        label: "Software productivo",
        category: "Operativos",
        account: "LUIS",
        responsible: "Luis",
        frequency: "monthly",
        impactCash: true,
        status: "pending",
        amount: 420,
        expenseKind: "fixed",
      },
      {
        id: "expense-3",
        label: "Reunión con cliente",
        category: "Operativos",
        account: "ALONDRA",
        responsible: "Alondra",
        frequency: "one_off",
        impactCash: true,
        status: "paid",
        amount: 180,
        expenseKind: "variable",
      },
    ];
    saveFinanceExpensePlans(plans);
  }

  const existing = listFinanceTransactions();
  if (existing.length > 0) return;

  const demo: FinanceTransaction[] = [
    {
      id: "txn-1001",
      date: new Date(now.getFullYear(), now.getMonth(), 2).toISOString(),
      type: "income",
      category: "Ventas",
      client: "Clínica San Pablo",
      amount: 8200,
      finalAmount: 8200,
      responsible: "Luis",
      accountFrom: undefined,
      accountTo: "LUIS",
      status: "paid",
      paidAt: new Date(now.getFullYear(), now.getMonth(), 3).toISOString(),
      referenceId: "REF-VENTA-001",
      monthKey,
      notes: "Paquete atención mensual",
    },
    {
      id: "txn-1002",
      date: new Date(now.getFullYear(), now.getMonth(), 4).toISOString(),
      type: "income",
      category: "Membresías",
      client: "Innova Dental",
      amount: 3600,
      finalAmount: 3600,
      responsible: "Alondra",
      accountTo: "KIMCE",
      status: "pending",
      referenceId: "REF-MEMB-002",
      monthKey,
    },
    {
      id: "txn-1003",
      date: new Date(now.getFullYear(), now.getMonth(), 6).toISOString(),
      type: "expense",
      category: "Operativos",
      amount: 1400,
      finalAmount: 1400,
      responsible: "Luis",
      accountFrom: "LUIS",
      status: "paid",
      paidAt: new Date(now.getFullYear(), now.getMonth(), 6).toISOString(),
      referenceId: "REF-OP-003",
      monthKey,
      expenseKind: "variable",
    },
    {
      id: "txn-1004",
      date: new Date(now.getFullYear(), now.getMonth(), 9).toISOString(),
      type: "collaborator_payment",
      category: "Personal",
      amount: 2200,
      finalAmount: 2200,
      responsible: "Alondra",
      accountFrom: "ALONDRA",
      status: "paid",
      paidAt: new Date(now.getFullYear(), now.getMonth(), 9).toISOString(),
      referenceId: "REF-PAGO-004",
      monthKey,
      notes: "Pago proyecto UX",
      collaboratorId: "collab-1",
    },
    {
      id: "txn-1005",
      date: new Date(now.getFullYear(), now.getMonth(), 12).toISOString(),
      type: "tax",
      category: "SUNAT",
      amount: 680,
      finalAmount: 680,
      responsible: "Luis",
      accountFrom: "KIMCE",
      status: "pending",
      referenceId: "REF-TAX-005",
      monthKey,
      expenseKind: "fixed",
    },
    {
      id: "txn-1006",
      date: new Date(now.getFullYear(), now.getMonth(), 14).toISOString(),
      type: "transfer",
      category: "Transferencias",
      amount: 2500,
      finalAmount: 2500,
      responsible: "Luis",
      accountFrom: "LUIS",
      accountTo: "KIMCE",
      status: "paid",
      paidAt: new Date(now.getFullYear(), now.getMonth(), 14).toISOString(),
      referenceId: "REF-TR-006",
      monthKey,
    },
  ];

  saveFinanceTransactions(demo);
}
