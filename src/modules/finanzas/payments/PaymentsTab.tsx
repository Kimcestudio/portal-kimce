import { useMemo } from "react";
import FinanceKpiRow from "@/modules/finanzas/shared/FinanceKpiRow";
import PaymentsTable from "@/modules/finanzas/payments/PaymentsTable";
import { calculatePaymentKpis, calculateVisiblePaymentsTotal } from "@/modules/finanzas/payments/payments.selectors";
import type { CollaboratorPayment, FinanceStatus } from "@/lib/finance/types";

interface PaymentsTabProps {
  payments: CollaboratorPayment[];
  collaboratorLookup: Map<string, string>;
  isSubmitting: boolean;
  onStatusChange: (id: string, status: FinanceStatus) => void;
  onEdit: (payment: CollaboratorPayment) => void;
  onDelete: (id: string) => void;
}

export default function PaymentsTab({
  payments,
  collaboratorLookup,
  isSubmitting,
  onStatusChange,
  onEdit,
  onDelete,
}: PaymentsTabProps) {
  const visiblePaymentsTotal = useMemo(() => calculateVisiblePaymentsTotal(payments), [payments]);
  const paymentTableKpis = useMemo(() => calculatePaymentKpis(payments), [payments]);

  return (
    <>
      <FinanceKpiRow
        items={[
          { title: "Total", value: paymentTableKpis.total, tone: "slate" },
          { title: "Pagado", value: paymentTableKpis.paid, tone: "green" },
          { title: "Pendiente", value: paymentTableKpis.pending, tone: "amber" },
          { title: "# Pagos", value: paymentTableKpis.count, tone: "blue" },
          { title: "Promedio", value: paymentTableKpis.avg, tone: "rose" },
        ]}
      />
      <PaymentsTable
        payments={payments}
        collaboratorLookup={collaboratorLookup}
        total={visiblePaymentsTotal}
        isSubmitting={isSubmitting}
        onStatusChange={onStatusChange}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </>
  );
}
