"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./client";
import type { MonthEndCheck, MonthEndTask } from "@/lib/monthEnd/types";

function toTask(id: string, data: DocumentData): MonthEndTask {
  return {
    id,
    area: data.area as string,
    title: data.title as string,
    description: data.description as string | undefined,
    active: data.active as boolean,
    order: (data.order as number) ?? 0,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? "",
  };
}

function toCheck(id: string, data: DocumentData): MonthEndCheck {
  return {
    id,
    taskId: data.taskId as string,
    area: data.area as string,
    period: data.period as string,
    completedAt: (data.completedAt as { toDate?: () => Date })?.toDate?.()?.toISOString() ?? "",
    completedBy: data.completedBy as string,
    completedByName: data.completedByName as string,
  };
}

export function useMonthEndTasks(area?: string) {
  const [tasks, setTasks] = useState<MonthEndTask[]>([]);

  useEffect(() => {
    const ref = collection(db, "monthEndTasks");
    const q = area ? query(ref, where("area", "==", area), where("active", "==", true)) : query(ref);
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => toTask(d.id, d.data())).sort((a, b) => a.order - b.order);
      setTasks(list);
    });
  }, [area]);

  return tasks;
}

export function useMonthEndChecks(area: string, period: string) {
  const [checks, setChecks] = useState<MonthEndCheck[]>([]);

  useEffect(() => {
    if (!area || !period) return;
    const q = query(
      collection(db, "monthEndChecks"),
      where("area", "==", area),
      where("period", "==", period),
    );
    return onSnapshot(q, (snap) => {
      setChecks(snap.docs.map((d) => toCheck(d.id, d.data())));
    });
  }, [area, period]);

  return checks;
}

export function useAllMonthEndChecks(period: string) {
  const [checks, setChecks] = useState<MonthEndCheck[]>([]);

  useEffect(() => {
    if (!period) return;
    const q = query(collection(db, "monthEndChecks"), where("period", "==", period));
    return onSnapshot(q, (snap) => {
      setChecks(snap.docs.map((d) => toCheck(d.id, d.data())));
    });
  }, [period]);

  return checks;
}

export async function addMonthEndTask(data: Omit<MonthEndTask, "id" | "createdAt">) {
  await addDoc(collection(db, "monthEndTasks"), { ...data, createdAt: serverTimestamp() });
}

export async function updateMonthEndTask(id: string, patch: Partial<Omit<MonthEndTask, "id" | "createdAt">>) {
  await updateDoc(doc(db, "monthEndTasks", id), patch);
}

export async function deleteMonthEndTask(id: string) {
  await deleteDoc(doc(db, "monthEndTasks", id));
}

export async function completeMonthEndCheck(
  taskId: string,
  area: string,
  period: string,
  uid: string,
  displayName: string,
) {
  await addDoc(collection(db, "monthEndChecks"), {
    taskId,
    area,
    period,
    completedAt: serverTimestamp(),
    completedBy: uid,
    completedByName: displayName,
  });
}

export async function uncompleteMonthEndCheck(checkId: string) {
  await deleteDoc(doc(db, "monthEndChecks", checkId));
}
