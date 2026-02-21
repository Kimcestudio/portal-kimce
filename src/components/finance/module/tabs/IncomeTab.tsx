import { useMemo } from "react";
import MovementsTable from "@/components/finance/module/MovementsTable";
import FinanceKpisRow from "@/components/finance/module/FinanceKpisRow";
import type { FinanceMovement, FinanceStatus } from "@/lib/finance/types";

interface IncomeTabProps {
  movements: FinanceMovement[];
  isSubmitting: boolean;
  onStatusChange: (id: string, status: FinanceStatus) => void;
  onEdit: (movement: FinanceMovement) => void;
  onDelete: (id: string) => void;
}

export default function IncomeTab({
  movements,
  isSubmitting,
  onStatusChange,
  onEdit,
  onDelete,
}: IncomeTabProps) {
  const movementTableKpis = useMemo(() => {
    const total = movements.reduce((sum, movement) => sum + (movement.tax?.total ?? movement.amount), 0);
    const paid = movements.reduce(
      (sum, movement) => sum + (movement.status !== "pending" ? movement.tax?.total ?? movement.amount : 0),
      0,
    );
    const pending = movements.reduce(
      (sum, movement) => sum + (movement.status === "pending" ? movement.tax?.total ?? movement.amount : 0),
      0,
    );
    const igv = movements.reduce((sum, movement) => sum + (movement.tax?.igv ?? 0), 0);
    const net = total - igv;
    return { total, paid, pending, igv, net };
  }, [movements]);

  return (
    <>
      <FinanceKpisRow
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
