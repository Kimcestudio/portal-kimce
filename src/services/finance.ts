import {
  addDoc,
  getDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
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

function getLastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getMonthKeyFromDateOnly(dateValue: string) {
  return dateValue.slice(0, 7);
}

function buildDateForMonth(monthKey: string, preferredDay: number) {
  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (Number.isNaN(year) || Number.isNaN(month)) return null;
  const day = Math.max(1, Math.min(preferredDay, getLastDayOfMonth(year, month)));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addMonths(dateValue: string, months: number) {
  const [yearPart, monthPart] = dateValue.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (Number.isNaN(year) || Number.isNaN(month)) return dateValue;
  const base = new Date(year, month - 1 + months, 1);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-01`;
}

function computeMonthlyDueDates({
  startAt,
  dayOfMonth,
  monthsCount,
}: {
  startAt: string;
  dayOfMonth: number;
  monthsCount: number;
}) {
  return Array.from({ length: monthsCount }, (_, index) => {
    const shiftedBase = addMonths(startAt, index);
    const monthKey = getMonthKeyFromDateOnly(shiftedBase);
    return buildDateForMonth(monthKey, dayOfMonth) ?? startAt;
  });
}

function deriveMonthsCountFromEndAt({
  startAt,
  endAt,
  dayOfMonth,
}: {
  startAt: string;
  endAt?: string | null;
  dayOfMonth: number;
}) {
  const normalizedEnd = endAt ? formatDateOnly(endAt) ?? endAt : null;
  if (!normalizedEnd) return 1;
  const normalizedStart = formatDateOnly(startAt) ?? startAt;
  let count = 0;
  for (let index = 0; index < 120; index += 1) {
    const shiftedBase = addMonths(normalizedStart, index);
    const monthKey = getMonthKeyFromDateOnly(shiftedBase);
    const dueDate = buildDateForMonth(monthKey, dayOfMonth) ?? normalizedStart;
    if (dueDate < normalizedStart) continue;
    if (dueDate > normalizedEnd) break;
    count += 1;
  }
  return Math.max(1, count);
}

export async function ensureRecurringMovementsForMonth(targetMonthKey: string) {
  if (!targetMonthKey) return;
  const templatesQuery = query(financeRefs.movementsRef, where("recurring.enabled", "==", true));
  const templatesSnapshot = await getDocs(templatesQuery);
  const templates = templatesSnapshot.docs.map((item) => normalizeMovement({ ...item.data(), id: item.id }));

  await Promise.all(
    templates
      .filter((template) => !template.generatedFromId)
      .filter((template) => template.recurring?.freq === "monthly")
      .filter((template) => targetMonthKey !== template.monthKey)
      .map(async (template) => {
        const normalizedStartAt = formatDateOnly(template.recurring?.startAt ?? template.incomeDate) ?? template.incomeDate;
        const dayOfMonth = (template.recurring?.dayOfMonth ?? Number(template.incomeDate.split("-")[2])) || 1;
        const existingMonthsCount = template.recurring?.monthsCount ?? null;
        const monthsCount =
          existingMonthsCount && existingMonthsCount > 0
            ? existingMonthsCount
            : deriveMonthsCountFromEndAt({
                startAt: normalizedStartAt,
                endAt: template.recurring?.endAt ?? null,
                dayOfMonth,
              });

        if (!existingMonthsCount || existingMonthsCount < 1) {
          await updateDoc(doc(financeRefs.movementsRef, template.id), {
            recurring: {
              ...(template.recurring ?? { enabled: true, freq: "monthly" as const }),
              startAt: normalizedStartAt,
              dayOfMonth,
              monthsCount,
            },
            updatedAt: new Date().toISOString(),
          });
        }

        const dueDates = computeMonthlyDueDates({
          startAt: normalizedStartAt,
          dayOfMonth,
          monthsCount,
        });
        const filteredDueDates = (template.recurring?.endAt
          ? dueDates.filter((dueDate) => dueDate <= (formatDateOnly(template.recurring?.endAt) ?? template.recurring?.endAt ?? dueDate))
          : dueDates);

        const targetDueDate = filteredDueDates.find((dueDate) => getMonthKeyFromDateOnly(dueDate) === targetMonthKey);
        if (!targetDueDate) return;

        const deterministicId = `rec_${template.id}_${targetMonthKey}`;
        const targetRef = doc(financeRefs.movementsRef, deterministicId);
        const existingDoc = await getDoc(targetRef);
        if (existingDoc.exists()) return;

        const now = new Date().toISOString();

        const generated: Omit<FinanceMovement, "id"> = {
          ...template,
          incomeDate: targetDueDate,
          monthKey: targetMonthKey,
          status: "pending",
          generatedFromId: template.id,
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(targetRef, generated);
      }),
  );
}

function getPreviousMonthKey(monthKey: string) {
  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (Number.isNaN(year) || Number.isNaN(month)) return monthKey;
  const base = new Date(year, month - 2, 1);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
}

function toPeriodo(monthKey: string) {
  const [year, month] = monthKey.split("-");
  return `${month}/${year}`;
}

export async function getPreviousMonthCopyCandidates(currentMonthKey: string) {
  const previousMonthKey = getPreviousMonthKey(currentMonthKey);
  const previousPeriodo = toPeriodo(previousMonthKey);

  const [movementsSnapshot, expensesSnapshot, paymentsByPeriodoSnapshot, paymentsByMonthKeySnapshot] = await Promise.all([
    getDocs(query(financeRefs.movementsRef, where("monthKey", "==", previousMonthKey))),
    getDocs(query(financeRefs.expensesRef, where("monthKey", "==", previousMonthKey))),
    getDocs(query(financeRefs.collaboratorPaymentsRef, where("periodo", "==", previousPeriodo))),
    getDocs(query(financeRefs.collaboratorPaymentsRef, where("monthKey", "==", previousMonthKey))),
  ]);

  const paymentMap = new Map<string, CollaboratorPayment>();
  [...paymentsByPeriodoSnapshot.docs, ...paymentsByMonthKeySnapshot.docs].forEach((item) => {
    paymentMap.set(item.id, normalizeCollaboratorPayment({ ...item.data(), id: item.id }));
  });

  return {
    previousMonthKey,
    movements: movementsSnapshot.docs.map((item) => normalizeMovement({ ...item.data(), id: item.id })),
    expenses: expensesSnapshot.docs.map((item) => normalizeExpense({ ...item.data(), id: item.id })),
    payments: Array.from(paymentMap.values()),
  };
}

export async function copyItemsFromPreviousMonth({
  currentMonthKey,
  movementIds,
  expenseIds,
  paymentIds,
  keepStatus,
}: {
  currentMonthKey: string;
  movementIds: string[];
  expenseIds: string[];
  paymentIds: string[];
  keepStatus: boolean;
}) {
  const { previousMonthKey, movements, expenses, payments } = await getPreviousMonthCopyCandidates(currentMonthKey);
  const targetPeriodo = toPeriodo(currentMonthKey);
  const copied = { movements: 0, expenses: 0, payments: 0 };

  await Promise.all(
    movementIds.map(async (id) => {
      const source = movements.find((item) => item.id === id);
      if (!source) return;
      const existing = await getDocs(query(financeRefs.movementsRef, where("copiedFromId", "==", source.id)));
      if (existing.docs.some((docSnap) => (docSnap.data().monthKey ?? "") === currentMonthKey)) return;

      const day = Number(source.incomeDate.split("-")[2]) || 1;
      const incomeDate = buildDateForMonth(currentMonthKey, day) ?? source.incomeDate;
      const now = new Date().toISOString();
      const payload: Omit<FinanceMovement, "id"> = {
        ...source,
        incomeDate,
        monthKey: currentMonthKey,
        status: keepStatus ? source.status : "pending",
        copiedFromId: source.id,
        copiedFromMonthKey: previousMonthKey,
        createdAt: now,
        updatedAt: now,
      };
      await addDoc(financeRefs.movementsRef, payload);
      copied.movements += 1;
    }),
  );

  await Promise.all(
    expenseIds.map(async (id) => {
      const source = expenses.find((item) => item.id === id);
      if (!source) return;
      const existing = await getDocs(query(financeRefs.expensesRef, where("copiedFromId", "==", source.id)));
      if (
        existing.docs.some((docSnap) => {
          const data = docSnap.data();
          const monthKey = data.monthKey ?? getMonthKeyFromDate(data.fechaGasto);
          return monthKey === currentMonthKey;
        })
      ) {
        return;
      }
      const day = Number(source.fechaGasto.split("-")[2]) || 1;
      const fechaGasto = buildDateForMonth(currentMonthKey, day) ?? source.fechaGasto;
      const now = new Date().toISOString();
      const payload: Omit<Expense, "id"> = {
        ...source,
        fechaGasto,
        monthKey: currentMonthKey,
        status: keepStatus ? source.status : "pending",
        copiedFromId: source.id,
        copiedFromMonthKey: previousMonthKey,
        createdAt: now,
        updatedAt: now,
      };
      await addDoc(financeRefs.expensesRef, payload);
      copied.expenses += 1;
    }),
  );

  await Promise.all(
    paymentIds.map(async (id) => {
      const source = payments.find((item) => item.id === id);
      if (!source) return;
      const existing = await getDocs(query(financeRefs.collaboratorPaymentsRef, where("copiedFromId", "==", source.id)));
      if (existing.docs.some((docSnap) => (docSnap.data().periodo ?? "") === targetPeriodo)) return;
      const now = new Date().toISOString();
      const payload: Omit<CollaboratorPayment, "id"> = {
        ...source,
        periodo: targetPeriodo,
        fechaPago: "",
        monthKey: currentMonthKey,
        status: keepStatus ? source.status : "pending",
        copiedFromId: source.id,
        copiedFromMonthKey: previousMonthKey,
        createdAt: now,
        updatedAt: now,
      };
      await addDoc(financeRefs.collaboratorPaymentsRef, payload);
      copied.payments += 1;
    }),
  );

  return copied;
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

export async function updateExpense(
  id: string,
  updates: Partial<Omit<Expense, "id" | "createdAt" | "updatedAt">>,
) {
  const nextUpdates = normalizeExpenseUpdates(updates);
  const cleanedUpdates = Object.fromEntries(
    Object.entries(nextUpdates).filter(([, value]) => value !== undefined),
  );
  await updateDoc(doc(financeRefs.expensesRef, id), {
    ...cleanedUpdates,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateCollaboratorPayment(
  id: string,
  updates: Partial<Omit<CollaboratorPayment, "id" | "createdAt" | "updatedAt">>,
) {
  const nextUpdates = normalizeCollaboratorPaymentUpdates(updates);
  const cleanedUpdates = Object.fromEntries(
    Object.entries(nextUpdates).filter(([, value]) => value !== undefined),
  );
  await updateDoc(doc(financeRefs.collaboratorPaymentsRef, id), {
    ...cleanedUpdates,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateTransfer(
  id: string,
  updates: Partial<Omit<TransferMovement, "id" | "createdAt" | "updatedAt">>,
) {
  const nextUpdates = normalizeTransferUpdates(updates);
  const cleanedUpdates = Object.fromEntries(
    Object.entries(nextUpdates).filter(([, value]) => value !== undefined),
  );
  await updateDoc(doc(financeRefs.transfersRef, id), {
    ...cleanedUpdates,
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

export async function deleteExpense(id: string) {
  await deleteDoc(doc(financeRefs.expensesRef, id));
}

export async function deleteCollaboratorPayment(id: string) {
  await deleteDoc(doc(financeRefs.collaboratorPaymentsRef, id));
}

export async function deleteTransfer(id: string) {
  await deleteDoc(doc(financeRefs.transfersRef, id));
}

function normalizeStatus(value: unknown): FinanceStatus {
  if (value === "pending" || value === "cancelled") {
    return value;
  }
  if (value === "PENDIENTE") return "pending";
  if (value === "CANCELADO") return "cancelled";
  if (value === "PAGADO" || value === "PAGADA") return "cancelled";
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

function normalizeExpenseUpdates(updates: Partial<Omit<Expense, "id" | "createdAt" | "updatedAt">>) {
  const fechaGasto = updates.fechaGasto ? formatDateOnly(updates.fechaGasto) ?? updates.fechaGasto : undefined;
  return {
    ...updates,
    fechaGasto,
    status: updates.status ? normalizeStatus(updates.status) : undefined,
    monthKey: fechaGasto ? getMonthKeyFromDate(fechaGasto) ?? undefined : undefined,
  };
}

function normalizeCollaboratorPaymentUpdates(
  updates: Partial<Omit<CollaboratorPayment, "id" | "createdAt" | "updatedAt">>,
) {
  const fechaPago = updates.fechaPago ? formatDateOnly(updates.fechaPago) ?? updates.fechaPago : undefined;
  return {
    ...updates,
    fechaPago,
    status: updates.status ? normalizeStatus(updates.status) : undefined,
    monthKey: fechaPago ? getMonthKeyFromDate(fechaPago) ?? undefined : undefined,
  };
}

function normalizeTransferUpdates(
  updates: Partial<Omit<TransferMovement, "id" | "createdAt" | "updatedAt">>,
) {
  const fecha = updates.fecha ? formatDateOnly(updates.fecha) ?? updates.fecha : undefined;
  return {
    ...updates,
    fecha,
    status: updates.status ? normalizeStatus(updates.status) : undefined,
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
