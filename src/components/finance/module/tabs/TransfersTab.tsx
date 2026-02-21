import { useMemo } from "react";
import FinanceKpisRow from "@/components/finance/module/FinanceKpisRow";
import TransfersTable from "@/components/finance/module/TransfersTable";
import type { FinanceStatus, TransferMovement } from "@/lib/finance/types";

interface TransfersTabProps {
  transfers: TransferMovement[];
  isSubmitting: boolean;
  onStatusChange: (id: string, status: FinanceStatus) => void;
  onEdit: (transfer: TransferMovement) => void;
  onDelete: (id: string) => void;
}

export default function TransfersTab({
  transfers,
  isSubmitting,
  onStatusChange,
  onEdit,
  onDelete,
}: TransfersTabProps) {
  const visibleTransfersTotal = useMemo(() => {
    return transfers.reduce(
      (totals, transfer) => {
        if (transfer.tipoMovimiento === "SALIDA_CAJA") {
          totals.out += transfer.monto;
          return totals;
        }
        if (transfer.tipoMovimiento === "INGRESO_CAJA") {
          totals.in += transfer.monto;
          return totals;
        }

        totals.in += transfer.monto;
        totals.out += transfer.monto;
        return totals;
      },
      { in: 0, out: 0 },
    );
  }, [transfers]);

  const cashTableKpis = useMemo(() => {
    const entries = visibleTransfersTotal.in;
    const exits = visibleTransfersTotal.out;
    const count = transfers.length;
    return {
      entries,
      exits,
      net: entries - exits,
      count,
    };
  }, [transfers, visibleTransfersTotal]);

  return (
    <>
      <FinanceKpisRow
        items={[
          { title: "Entradas", value: cashTableKpis.entries, tone: "green" },
          { title: "Salidas", value: cashTableKpis.exits, tone: "rose" },
          { title: "Neto", value: cashTableKpis.net, tone: "slate" },
          { title: "# Movimientos", value: cashTableKpis.count, tone: "blue" },
          { title: "Saldo", value: cashTableKpis.net, tone: "amber" },
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
