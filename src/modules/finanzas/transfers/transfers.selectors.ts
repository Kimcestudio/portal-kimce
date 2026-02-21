import type { TransferMovement } from "@/lib/finance/types";

export const calculateVisibleTransfersTotal = (transfers: TransferMovement[]) => {
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
};

export const calculateTransferKpis = (transfers: TransferMovement[]) => {
  const totals = calculateVisibleTransfersTotal(transfers);
  const entries = totals.in;
  const exits = totals.out;
  const count = transfers.length;
  return {
    entries,
    exits,
    net: entries - exits,
    count,
    totals,
  };
};
