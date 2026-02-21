import type { CollaboratorPayment } from "@/lib/finance/types";

export const calculateVisiblePaymentsTotal = (payments: CollaboratorPayment[]) =>
  payments.reduce((sum, payment) => sum + payment.montoFinal, 0);

export const calculatePaymentKpis = (payments: CollaboratorPayment[]) => {
  const total = calculateVisiblePaymentsTotal(payments);
  const paid = payments.reduce((sum, payment) => sum + (payment.status !== "pending" ? payment.montoFinal : 0), 0);
  const pending = payments.reduce((sum, payment) => sum + (payment.status === "pending" ? payment.montoFinal : 0), 0);
  const count = payments.length;
  const avg = count > 0 ? total / count : 0;
  return { total, paid, pending, count, avg };
};
