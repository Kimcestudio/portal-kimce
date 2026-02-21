import { useMemo } from "react";
import FinanceKpiRow from "@/modules/finanzas/shared/FinanceKpiRow";
import MovementsTable from "@/modules/finanzas/movements/MovementsTable";
import { calculateMovementKpis } from "@/modules/finanzas/movements/movements.selectors";
import type { FinanceMovement, FinanceStatus } from "@/lib/finance/types";

interface MovementsTabProps {
  movements: FinanceMovement[];
  isSubmitting: boolean;
  onStatusChange: (id: string, status: FinanceStatus) => void;
  onEdit: (movement: FinanceMovement) => void;
  onDelete: (id: string) => void;
}

export default function MovementsTab({ movements, isSubmitting, onStatusChange, onEdit, onDelete }: MovementsTabProps) {
  const movementTableKpis = useMemo(() => calculateMovementKpis(movements), [movements]);

  return (
    <>
      <FinanceKpiRow
        items={[
          { title: "Total", value: movementTableKpis.total, tone: "slate" },
          { title: "Cobrado", value: movementTableKpis.paid, tone: "green" },
          { title: "Pendiente", value: movementTableKpis.pending, tone: "amber" },
          { title: "IGV", value: movementTableKpis.igv, tone: "blue" },
          { title: "Neto", value: movementTableKpis.net, tone: "rose" },
        ]}
      />
      <MovementsTable
        movements={movements}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
        onEdit={onEdit}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
