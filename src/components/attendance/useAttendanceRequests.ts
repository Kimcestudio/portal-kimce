"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import type { CorrectionRequest, ExtraActivity, Request } from "@/lib/storage/attendanceStorage";
import { createCorrectionRequest, listRecentCorrections } from "@/lib/storage/attendanceStorage";
import { db } from "@/services/firebase/client";
import { formatISODate, getWeekKey } from "@/lib/attendanceUtils";
import type { ApprovedAttendanceRequest } from "@/lib/attendanceUtils";

type FirestoreStatus = "PENDING" | "APPROVED" | "REJECTED";

export type CorrectionDraft = {
  date: string;
  attendanceId: string;
  proposedChanges: string;
  reason: string;
};

export const emptyCorrection: CorrectionDraft = {
  date: "",
  attendanceId: "",
  proposedChanges: "",
  reason: "",
};

function normalizeStatus(value: string | undefined): FirestoreStatus {
  if (value?.toUpperCase() === "APPROVED") return "APPROVED";
  if (value?.toUpperCase() === "REJECTED") return "REJECTED";
  return "PENDING";
}

function normalizeExtraType(value: string | undefined): ExtraActivity["type"] {
  if (value === "Reunión" || value === "Grabación" || value === "Urgencia" || value === "Evento" || value === "Otro") {
    return value;
  }
  return "Otro";
}

type AttendanceUserRef = {
  uid: string;
} | null | undefined;

export function useAttendanceRequests(user: AttendanceUserRef) {
  const [extras, setExtras] = useState<ExtraActivity[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [extraOpen, setExtraOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [extraDraft, setExtraDraft] = useState({
    date: formatISODate(new Date()),
    minutes: 60,
    type: "Reunión",
    project: "",
    note: "",
  });
  const [requestDraft, setRequestDraft] = useState({
    type: "DIA_LIBRE",
    date: formatISODate(new Date()),
    endDate: "",
    hours: 1,
    reason: "",
  });
  const [correctionDraft, setCorrectionDraft] = useState<CorrectionDraft>(emptyCorrection);
  const [pendingHourRequestsCount, setPendingHourRequestsCount] = useState(0);
  const [pendingExtraActivitiesCount, setPendingExtraActivitiesCount] = useState(0);
  const [approvedExtraActivities, setApprovedExtraActivities] = useState<{ date: string; minutes: number }[]>([]);
  const [approvedHourRequests, setApprovedHourRequests] = useState<ApprovedAttendanceRequest[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setExtras([]);
      setRequests([]);
      setPendingHourRequestsCount(0);
      setPendingExtraActivitiesCount(0);
      setApprovedExtraActivities([]);
      setApprovedHourRequests([]);
      return;
    }

    const hourRequestsRef = query(collection(db, "hourRequests"), where("uid", "==", user.uid));
    const extraActivitiesRef = query(collection(db, "extraActivities"), where("uid", "==", user.uid));

    const unsubscribeHourRequests = onSnapshot(
      hourRequestsRef,
      (snapshot) => {
        const docs = snapshot.docs;

        setPendingHourRequestsCount(
          docs.filter((docSnap) => {
            const data = docSnap.data() as { status?: string };
            return (data.status ?? "").toLowerCase() === "pending";
          }).length,
        );

        const mappedRequests = docs
          .map((docSnap) => {
            const data = docSnap.data() as {
              type?: string;
              date?: string;
              endDate?: string | null;
              hours?: number | null;
              reason?: string;
              status?: string;
              createdAt?: { toDate?: () => Date };
            };
            return {
              id: docSnap.id,
              userId: user.uid,
              type: (data.type as Request["type"]) ?? "DIA_LIBRE",
              date: data.date ?? "",
              endDate: data.endDate ?? undefined,
              hours: typeof data.hours === "number" ? data.hours : undefined,
              reason: data.reason ?? "",
              status: normalizeStatus(data.status),
              createdAt: data.createdAt?.toDate?.()?.toISOString() ?? "",
            } satisfies Request;
          })
          .filter((item) => item.date)
          .sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
          })
          .slice(0, 6);
        setRequests(mappedRequests);

        const approvedReqs = docs
          .map((docSnap) => {
            const data = docSnap.data() as {
              status?: string;
              type?: string;
              date?: string;
              endDate?: string | null;
              hours?: number | null;
              reason?: string | null;
            };
            if ((data.status ?? "").toLowerCase() !== "approved" || !data.date) return null;
            return {
              uid: user.uid,
              type: data.type ?? "DIA_LIBRE",
              date: data.date,
              endDate: data.endDate ?? null,
              hours: typeof data.hours === "number" ? data.hours : null,
              reason: data.reason ?? null,
            } satisfies ApprovedAttendanceRequest;
          })
          .filter(Boolean) as ApprovedAttendanceRequest[];
        setApprovedHourRequests(approvedReqs);
      },
      (error) => {
        console.error("[attendance] Error loading hourRequests", error);
      },
    );

    const unsubscribeExtraActivities = onSnapshot(
      extraActivitiesRef,
      (snapshot) => {
        const docs = snapshot.docs;

        setPendingExtraActivitiesCount(
          docs.filter((docSnap) => {
            const data = docSnap.data() as { status?: string };
            return (data.status ?? "").toLowerCase() === "pending";
          }).length,
        );

        const mappedExtras = docs
          .map((docSnap) => {
            const data = docSnap.data() as {
              type?: string;
              date?: string;
              minutes?: number;
              hours?: number;
              project?: string | null;
              note?: string | null;
              status?: string;
              createdAt?: { toDate?: () => Date };
            };
            const minutes =
              typeof data.minutes === "number"
                ? data.minutes
                : typeof data.hours === "number"
                  ? Math.round(data.hours * 60)
                  : 0;
            return {
              id: docSnap.id,
              userId: user.uid,
              date: data.date ?? "",
              minutes,
              type: normalizeExtraType(data.type),
              project: data.project ?? undefined,
              note: data.note ?? undefined,
              status: normalizeStatus(data.status),
              createdAt: data.createdAt?.toDate?.()?.toISOString() ?? "",
            } satisfies ExtraActivity;
          })
          .filter((item) => item.date)
          .sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
          })
          .slice(0, 6);
        setExtras(mappedExtras);

        const approvedExtras = docs
          .map((docSnap) => {
            const data = docSnap.data() as {
              status?: string;
              date?: string;
              minutes?: number;
              hours?: number;
            };
            if ((data.status ?? "").toLowerCase() !== "approved" || !data.date) return null;
            const minutes =
              typeof data.minutes === "number"
                ? data.minutes
                : typeof data.hours === "number"
                  ? Math.round(data.hours * 60)
                  : 0;
            return { date: data.date as string, minutes };
          })
          .filter(Boolean) as { date: string; minutes: number }[];
        setApprovedExtraActivities(approvedExtras);
      },
      (error) => {
        console.error("[attendance] Error loading extraActivities", error);
      },
    );

    return () => {
      unsubscribeHourRequests();
      unsubscribeExtraActivities();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    setCorrections(listRecentCorrections(user.uid, 6));
  }, [extraOpen, requestOpen, correctionOpen, user]);

  const handleSubmitExtra = async () => {
    if (!user) return;
    const payload = {
      uid: user.uid,
      weekKey: getWeekKey(extraDraft.date),
      status: "pending",
      createdAt: serverTimestamp(),
      type: extraDraft.type,
      date: extraDraft.date,
      minutes: extraDraft.minutes,
      hours: Math.round((extraDraft.minutes / 60) * 10) / 10,
      project: extraDraft.project || null,
      note: extraDraft.note || null,
      reason: extraDraft.note || null,
    };
    try {
      await addDoc(collection(db, "extraActivities"), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      const err = error as { code?: string; message?: string };
      console.error("[attendance] Error creating extra activity", err?.code, err?.message, error);
      setMessage(`No se pudo registrar actividad extra (${err?.code ?? "unknown"}).`);
      return;
    }
    setExtraOpen(false);
    setExtraDraft((prev) => ({ ...prev, project: "", note: "" }));
  };

  const handleSubmitRequest = async () => {
    if (!user) return;
    try {
      const weekKey = getWeekKey(requestDraft.date);

      const weekKeys: string[] = [weekKey];
      if (requestDraft.endDate && requestDraft.endDate > requestDraft.date) {
        const cursor = new Date(`${requestDraft.date}T00:00:00`);
        const end = new Date(`${requestDraft.endDate}T00:00:00`);
        cursor.setDate(cursor.getDate() + 7);
        while (cursor <= end) {
          const wk = getWeekKey(formatISODate(cursor));
          if (!weekKeys.includes(wk)) weekKeys.push(wk);
          cursor.setDate(cursor.getDate() + 7);
        }
      }

      await addDoc(collection(db, "hourRequests"), {
        uid: user.uid,
        weekKey,
        weekKeys,
        status: "pending",
        createdAt: serverTimestamp(),
        type: requestDraft.type,
        date: requestDraft.date,
        endDate: requestDraft.endDate || null,
        hours: requestDraft.type === "PERMISO_HORAS" ? requestDraft.hours : null,
        reason: requestDraft.reason,
      });
    } catch (error) {
      const err = error as { code?: string; message?: string };
      console.error("[attendance] Error creating hour request", err?.code, err?.message, error);
      setMessage("No se pudo enviar la solicitud. Verifica tus permisos.");
    }
    setRequestOpen(false);
    setRequestDraft((prev) => ({ ...prev, reason: "" }));
  };

  const handleSubmitCorrection = async () => {
    if (!user) return;
    createCorrectionRequest(user.uid, {
      date: correctionDraft.date,
      attendanceId: correctionDraft.attendanceId,
      proposedChanges: correctionDraft.proposedChanges,
      reason: correctionDraft.reason,
    });
    try {
      await addDoc(collection(db, "correctionRequests"), {
        uid: user.uid,
        date: correctionDraft.date,
        attendanceId: correctionDraft.attendanceId,
        proposedChanges: correctionDraft.proposedChanges,
        reason: correctionDraft.reason,
        status: "pending",
        createdAt: serverTimestamp(),
        weekKey: getWeekKey(correctionDraft.date),
      });
    } catch (error) {
      console.error("[attendance] Error saving correction to Firestore", error);
    }
    setCorrectionOpen(false);
    setCorrectionDraft(emptyCorrection);
    setCorrections(listRecentCorrections(user.uid, 6));
  };

  const handleOpenCorrection = (dateISO: string, attendanceId: string) => {
    setCorrectionDraft({ date: dateISO, attendanceId, proposedChanges: "", reason: "" });
    setCorrectionOpen(true);
  };

  return {
    extras,
    requests,
    corrections,
    filter,
    setFilter,
    extraOpen,
    setExtraOpen,
    requestOpen,
    setRequestOpen,
    correctionOpen,
    setCorrectionOpen,
    extraDraft,
    setExtraDraft,
    requestDraft,
    setRequestDraft,
    correctionDraft,
    setCorrectionDraft,
    pendingHourRequestsCount,
    pendingExtraActivitiesCount,
    approvedExtraActivities,
    approvedHourRequests,
    handleSubmitExtra,
    handleSubmitRequest,
    handleSubmitCorrection,
    handleOpenCorrection,
    requestsMessage: message,
    setRequestsMessage: setMessage,
  };
}
