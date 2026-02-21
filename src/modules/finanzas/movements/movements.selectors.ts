import type { FinanceMovement } from "@/lib/finance/types";

export const calculateMovementKpis = (movements: FinanceMovement[]) => {
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
};
