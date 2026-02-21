import { useMemo } from "react";
import FinanceKpiRow from "@/modules/finanzas/shared/FinanceKpiRow";
import TransfersTable from "@/modules/finanzas/transfers/TransfersTable";
import { calculateTransferKpis, calculateVisibleTransfersTotal } from "@/modules/finanzas/transfers/transfers.selectors";
import type { FinanceStatus, TransferMovement } from "@/lib/finance/types";

interface TransfersTabProps {
  transfers: TransferMovement[];
  isSubmitting: boolean;
  onStatusChange: (id: string, status: FinanceStatus) => void;
  onEdit: (transfer: TransferMovement) => void;
  onDelete: (id: string) => void;
}

export default function TransfersTab({ transfers, isSubmitting, onStatusChange, onEdit, onDelete }: TransfersTabProps) {
  const visibleTransfersTotal = useMemo(() => calculateVisibleTransfersTotal(transfers), [transfers]);
  const transferKpis = useMemo(() => calculateTransferKpis(transfers), [transfers]);

  return (
    <>
      <FinanceKpiRow
        items={[
          { title: "Entradas", value: transferKpis.entries, tone: "green" },
          { title: "Salidas", value: transferKpis.exits, tone: "rose" },
          { title: "Neto", value: transferKpis.net, tone: "slate" },
          { title: "# Movimientos", value: transferKpis.count, tone: "blue" },
          { title: "Saldo", value: transferKpis.net, tone: "amber" },
        ]}
      />
      <TransfersTable
        transfers={transfers}
        totals={visibleTransfersTotal}
        isSubmitting={isSubmitting}
        onStatusChange={onStatusChange}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </>
  );
}
