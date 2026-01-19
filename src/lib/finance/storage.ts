import { getCollection, setCollection } from "@/services/firebase/db";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceMonthClosure,
  FinanceTransaction,
  FinanceTransactionStatus,
} from "@/lib/finance/types";
import { calcFinalAmount, getMonthKey } from "@/lib/finance/utils";

const TRANSACTIONS_COLLECTION = "financeTransactions";
const ACCOUNTS_COLLECTION = "financeAccounts";
const CATEGORIES_COLLECTION = "financeCategories";
const MONTH_CLOSURE_COLLECTION = "financeMonthClosures";

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
    finalAmount: input.finalAmount ?? calcFinalAmount({
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
      client: "Membresías Pro",
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
