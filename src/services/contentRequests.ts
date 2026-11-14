"use client";

import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/services/firebase/client";
import type { TeamCategory } from "@/cmhub/types";

export const FORMAT_TO_AREA: Record<string, TeamCategory> = {
  "Post / RRSS": "CM",
  "Flyer":       "Diseño",
  "Video":       "Audiovisual",
  "PPT":         "Estrategia",
  "Diseño":      "Diseño",
  "Informe":     "Estrategia",
  "Otro":        "Agencia",
};

export function areaForFormato(formato: string): TeamCategory {
  return FORMAT_TO_AREA[formato] ?? "Agencia";
}

export type ClientNoteEntry = { text: string; at: string };

export type ContentRequest = {
  id: string;
  brandId: string;
  requestedBy: string;
  titulo?: string;
  formato: string;
  /** Área del equipo KIMCE auto-asignada según el formato */
  area?: TeamCategory;
  requerimiento: string;
  entregables?: string;
  pais: string;
  objetivo: string;
  deadline: string;
  canal: string;
  status: "pendiente" | "finalizado";
  update?: string;
  clientNote?: string;
  clientNoteAt?: string;
  clientNotes?: ClientNoteEntry[];
  createdAt: string;
  updatedAt?: string;
  /** Número de fila en Google Sheets; undefined para solicitudes creadas desde el portal */
  sheetRow?: number;
  /** Persona del equipo a quien se derivó la solicitud (ID en userDirectory) */
  assignedTo?: string;
  /** Nombre para display, guardado junto con assignedTo */
  assignedToName?: string;
};

const COLLECTION = "client_content_requests";

export function subscribeContentRequests(
  brandId: string,
  onData: (requests: ContentRequest[]) => void,
  onError?: (err: Error) => void,
) {
  // Sin orderBy para evitar requerir índice compuesto; se ordena en cliente.
  const q = query(
    collection(db, COLLECTION),
    where("brandId", "==", brandId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const requests = snap.docs
        .map((d) => {
          const data = d.data();
          const formato = data.formato ?? "";
          return {
            id: d.id,
            brandId: data.brandId ?? "",
            requestedBy: data.requestedBy ?? "",
            titulo: data.titulo ?? "",
            formato,
            area: (data.area ?? areaForFormato(formato)) as TeamCategory,
            requerimiento: data.requerimiento ?? "",
            entregables: data.entregables ?? "",
            pais: data.pais ?? "",
            objetivo: data.objetivo ?? "",
            deadline: data.deadline ?? "",
            canal: data.canal ?? "",
            status: data.status ?? "pendiente",
            update: data.update ?? "",
            clientNote: data.clientNote,
            clientNoteAt: data.clientNoteAt,
            clientNotes: data.clientNotes ?? undefined,
            createdAt: data.createdAt?.toDate?.().toISOString?.() ?? data.createdAt ?? "",
            updatedAt: data.updatedAt?.toDate?.().toISOString?.() ?? data.updatedAt,
            sheetRow: typeof data.sheetRow === "number" ? data.sheetRow : undefined,
            assignedTo: data.assignedTo,
            assignedToName: data.assignedToName,
          } as ContentRequest;
        })
        // sheetRow DESC: fila más alta = más reciente en la hoja Google.
        // Registros sin sheetRow (creados desde el portal) van al principio (Infinity).
        .sort((a, b) => {
          const ra = a.sheetRow ?? Infinity;
          const rb = b.sheetRow ?? Infinity;
          if (ra !== rb) return rb - ra;
          // Tiebreaker por createdAt cuando dos registros comparten sheetRow (raro)
          return (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0);
        });
      onData(requests);
    },
    (err) => {
      console.error("[contentRequests] onSnapshot error:", err);
      onError?.(err);
      onData([]);
    },
  );
}

export async function addContentRequest(
  data: Omit<ContentRequest, "id" | "status" | "area" | "createdAt" | "updatedAt" | "sheetRow">,
) {
  await addDoc(collection(db, COLLECTION), {
    ...data,
    area: areaForFormato(data.formato),
    status: "pendiente",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateContentRequest(
  id: string,
  patch: Partial<Pick<ContentRequest, "status" | "update" | "clientNote" | "clientNoteAt" | "assignedTo" | "assignedToName">>,
) {
  await updateDoc(doc(db, COLLECTION, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function bulkImportRequests(
  rows: Omit<ContentRequest, "id" | "createdAt" | "updatedAt" | "sheetRow">[],
  brandId: string,
) {
  const { writeBatch, doc } = await import("firebase/firestore");
  const batches: ReturnType<typeof writeBatch>[] = [];
  let current = writeBatch(db);
  let count = 0;
  for (const row of rows) {
    const ref = doc(collection(db, COLLECTION));
    current.set(ref, {
      ...row,
      brandId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    count++;
    if (count % 499 === 0) { batches.push(current); current = writeBatch(db); }
  }
  batches.push(current);
  await Promise.all(batches.map((b) => b.commit()));
}

export async function deleteContentRequest(id: string) {
  const { deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function deleteAllContentRequests(brandId: string) {
  const { writeBatch, getDocs } = await import("firebase/firestore");
  const q = query(collection(db, COLLECTION), where("brandId", "==", brandId));
  const snap = await getDocs(q);
  const batches: ReturnType<typeof writeBatch>[] = [];
  let current = writeBatch(db);
  let count = 0;
  for (const d of snap.docs) {
    current.delete(d.ref);
    count++;
    if (count % 499 === 0) { batches.push(current); current = writeBatch(db); }
  }
  batches.push(current);
  await Promise.all(batches.map((b) => b.commit()));
  return snap.size;
}

export async function updateClientRequest(
  id: string,
  patch: Pick<ContentRequest, 'deadline' | 'requerimiento' | 'objetivo' | 'canal' | 'entregables' | 'formato' | 'pais' | 'requestedBy'> & { titulo?: string },
) {
  await updateDoc(doc(db, COLLECTION, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function addClientNote(id: string, note: string) {
  const trimmed = note.trim();
  const entry: ClientNoteEntry = { text: trimmed, at: new Date().toISOString() };
  await updateDoc(doc(db, COLLECTION, id), {
    clientNote: trimmed,
    clientNoteAt: serverTimestamp(),
    clientNotes: arrayUnion(entry),
  });
}

export const AREA_COLOR: Record<string, string> = {
  CM:          '#10b981',
  Diseño:      '#ec4899',
  Audiovisual: '#f97316',
  Estrategia:  '#6366f1',
  Agencia:     '#0844ef',
};

export const FORMATOS = [
  "Post / RRSS",
  "Flyer",
  "Video",
  "PPT",
  "Diseño",
  "Informe",
  "Otro",
] as const;

export const PAISES = [
  "Institucional",
  "CAM (Centroamérica)",
  "Perú",
  "Colombia",
  "Chile",
  "Ecuador",
  "Bolivia",
  "México",
  "República Dominicana",
  "Todos los países",
  "Otros",
] as const;

export const CANALES = [
  "RRSS",
  "Digital",
  "Impreso",
  "WhatsApp",
  "Email",
  "Caja de pedido",
  "Digital / Impreso",
] as const;
