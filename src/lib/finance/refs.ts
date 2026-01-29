import { collection, type CollectionReference } from "firebase/firestore";
import type {
  Collaborator,
  CollaboratorPayment,
  Expense,
  FinanceMovement,
  TransferMovement,
} from "@/lib/finance/types";
import { db } from "@/services/firebase/client";

export const financeCollectionPaths = {
  movements: "finance_movements",
  incomes: "finance_movements",
  expenses: "expenses",
  transfers: "transfers",
  collaboratorPayments: "collaboratorPayments",
  collaborators: "collaborators",
};

export const financeRefs = {
  movementsRef: collection(db, financeCollectionPaths.movements) as CollectionReference<FinanceMovement>,
  incomesRef: collection(db, financeCollectionPaths.incomes) as CollectionReference<FinanceMovement>,
  expensesRef: collection(db, financeCollectionPaths.expenses) as CollectionReference<Expense>,
  transfersRef: collection(db, financeCollectionPaths.transfers) as CollectionReference<TransferMovement>,
  collaboratorPaymentsRef: collection(
    db,
    financeCollectionPaths.collaboratorPayments,
  ) as CollectionReference<CollaboratorPayment>,
  collaboratorsRef: collection(db, financeCollectionPaths.collaborators) as CollectionReference<Collaborator>,
};
