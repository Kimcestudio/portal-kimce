"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/services/firebase/client";

export type ClientDocument = {
  id: string;
  title: string;
  clientName: string;
  fileName: string;
  mimeType: string;
  size: number;
  publicPath?: string;
  dataUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  source?: "static" | "dynamic";
};

export const STATIC_CLIENT_DOCUMENTS: ClientDocument[] = [
  {
    id: "msl-estrategia-2026",
    title: "Estrategia Digital 2026",
    clientName: "Mujeres Sin Limites",
    fileName: "MSL_Estrategia_2026.html",
    mimeType: "text/html",
    size: 64988,
    publicPath: "/clientes/msl/estrategia-2026.html",
    createdAt: "2026-05-26T00:00:00.000Z",
    updatedAt: "2026-05-26T00:00:00.000Z",
    source: "static",
  },
];

const COLLECTION = "clientDocuments";

function normalizeDocument(id: string, data: DocumentData): ClientDocument {
  return {
    id,
    title: data.title ?? "Documento de cliente",
    clientName: data.clientName ?? "Cliente",
    fileName: data.fileName ?? "archivo",
    mimeType: data.mimeType ?? "application/octet-stream",
    size: Number(data.size ?? 0),
    publicPath: data.publicPath,
    dataUrl: data.dataUrl,
    createdAt: data.createdAt?.toDate?.().toISOString?.() ?? data.createdAt,
    updatedAt: data.updatedAt?.toDate?.().toISOString?.() ?? data.updatedAt,
    source: "dynamic",
  };
}

export function getStaticClientDocument(id: string) {
  return STATIC_CLIENT_DOCUMENTS.find((document) => document.id === id) ?? null;
}

export async function listClientDocuments() {
  try {
    const dynamicDocs = await getDocs(query(collection(db, COLLECTION), orderBy("createdAt", "desc")));
    return [
      ...STATIC_CLIENT_DOCUMENTS,
      ...dynamicDocs.docs.map((snapshot) => normalizeDocument(snapshot.id, snapshot.data())),
    ];
  } catch {
    return STATIC_CLIENT_DOCUMENTS;
  }
}

export async function getClientDocument(id: string) {
  const staticDocument = getStaticClientDocument(id);
  if (staticDocument) return staticDocument;

  const snapshot = await getDoc(doc(db, COLLECTION, id));
  if (!snapshot.exists()) return null;
  return normalizeDocument(snapshot.id, snapshot.data());
}

export async function uploadClientDocument(input: {
  title: string;
  clientName: string;
  file: File;
  dataUrl: string;
}) {
  const id = `${input.clientName}-${input.title}-${Date.now()}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const payload = {
    title: input.title.trim(),
    clientName: input.clientName.trim(),
    fileName: input.file.name,
    mimeType: input.file.type || "application/octet-stream",
    size: input.file.size,
    dataUrl: input.dataUrl,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, COLLECTION, id), payload);
  return id;
}

export async function updateClientDocumentFile(input: {
  id: string;
  file: File;
  dataUrl: string;
}) {
  await setDoc(
    doc(db, COLLECTION, input.id),
    {
      fileName: input.file.name,
      mimeType: input.file.type || "application/octet-stream",
      size: input.file.size,
      dataUrl: input.dataUrl,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteClientDocument(id: string) {
  await deleteDoc(doc(db, COLLECTION, id));
}

export function getClientDocumentUrl(id: string) {
  if (id === "msl-estrategia-2026") return "/clientes/msl-estrategia-2026";
  return `/clientes/documento?id=${encodeURIComponent(id)}`;
}

export function getClientDocumentOpenUrl(document: ClientDocument) {
  if (document.publicPath) return document.publicPath;
  return `/clientes/archivo?id=${encodeURIComponent(document.id)}`;
}
