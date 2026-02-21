import TransfersTab from "@/modules/finanzas/transfers/TransfersTab";
import type { FinanceStatus, TransferMovement } from "@/lib/finance/types";

interface AccountsTabProps {
  transfers: TransferMovement[];
  isSubmitting: boolean;
  onStatusChange: (id: string, status: FinanceStatus) => void;
  onEdit: (transfer: TransferMovement) => void;
  onDelete: (id: string) => void;
}

export default function AccountsTab(props: AccountsTabProps) {
  return <TransfersTab {...props} />;
}
