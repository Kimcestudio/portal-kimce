import { useMemo } from "react";
import FinanceKpisRow from "@/components/finance/module/FinanceKpisRow";
import PaymentsTable from "@/components/finance/module/PaymentsTable";
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
  const visiblePaymentsTotal = useMemo(
    () => payments.reduce((sum, payment) => sum + payment.montoFinal, 0),
    [payments],
  );

  const paymentTableKpis = useMemo(() => {
    const total = visiblePaymentsTotal;
    const paid = payments.reduce(
      (sum, payment) => sum + (payment.status !== "pending" ? payment.montoFinal : 0),
      0,
    );
    const pending = payments.reduce(
      (sum, payment) => sum + (payment.status === "pending" ? payment.montoFinal : 0),
      0,
    );
    const count = payments.length;
    const avg = count > 0 ? total / count : 0;
    return { total, paid, pending, count, avg };
  }, [payments, visiblePaymentsTotal]);

  return (
    <>
      <FinanceKpisRow
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
