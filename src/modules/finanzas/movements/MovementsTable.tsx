import FinanceTable from "@/components/finance/FinanceTable";
import type { FinanceMovement, FinanceStatus } from "@/lib/finance/types";

interface MovementsTableProps {
  movements: FinanceMovement[];
  isSubmitting: boolean;
  onStatusChange: (id: string, status: FinanceStatus) => void;
  onEdit: (movement: FinanceMovement) => void;
  onDelete: (id: string) => void;
}

export default function MovementsTable({
  movements,
  isSubmitting,
  onStatusChange,
  onEdit,
  onDelete,
}: MovementsTableProps) {
  return (
    <FinanceTable
      movements={movements}
      onStatusChange={onStatusChange}
      onEdit={onEdit}
      onDelete={onDelete}
      disabled={isSubmitting}
    />
  );
}
