"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, FileUp, Loader2, Plus, RefreshCw, UploadCloud } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { readFileAsDataUrl } from "@/services/firebase/media";
import {
  getClientDocumentUrl,
  listClientDocuments,
  updateClientDocumentFile,
  uploadClientDocument,
  type ClientDocument,
} from "@/services/clientDocuments";

const MAX_FIRESTORE_FILE_SIZE = 750 * 1024;

function formatSize(size: number) {
  if (!size) return "-";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function absolutePublicUrl(path: string) {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export default function AdminClientesPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [updatingDocumentId, setUpdatingDocumentId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const canUpload = useMemo(() => {
    return Boolean(title.trim().length > 2 && clientName.trim().length > 2 && selectedFile && !isUploading);
  }, [clientName, isUploading, selectedFile, title]);

  async function refreshDocuments() {
    try {
      setIsLoading(true);
      const nextDocuments = await listClientDocuments();
      setDocuments(nextDocuments);
    } catch {
      setMessage("No se pudo leer la biblioteca de clientes.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshDocuments();
  }, []);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return;

    if (selectedFile.size > MAX_FIRESTORE_FILE_SIZE) {
      setMessage("Por ahora sube archivos de hasta 750 KB para mantener el enlace publico estable.");
      return;
    }

    try {
      setIsUploading(true);
      setMessage("");
      const dataUrl = await readFileAsDataUrl(selectedFile);
      const id = await uploadClientDocument({
        title,
        clientName,
        file: selectedFile,
        dataUrl,
      });
      const publicUrl = absolutePublicUrl(getClientDocumentUrl(id));
      await navigator.clipboard?.writeText(publicUrl);
      setMessage("Archivo publicado. El enlace publico fue copiado al portapapeles.");
      setTitle("");
      setClientName("");
      setSelectedFile(null);
      await refreshDocuments();
    } catch {
      setMessage("No se pudo publicar el archivo. Verifica permisos de administrador y conexion.");
    } finally {
      setIsUploading(false);
    }
  }

  async function copyLink(document: ClientDocument) {
    const publicUrl = absolutePublicUrl(getClientDocumentUrl(document.id));
    await navigator.clipboard?.writeText(publicUrl);
    setMessage(`Enlace copiado: ${publicUrl}`);
  }

  async function handleReplaceFile(document: ClientDocument, file: File | null) {
    if (!file) return;

    if (document.source === "static" || document.publicPath) {
      setMessage("Este archivo base esta publicado como archivo fijo del sitio. Para actualizarlo hay que reemplazarlo en el proyecto y desplegar.");
      return;
    }

    if (file.size > MAX_FIRESTORE_FILE_SIZE) {
      setMessage("Por ahora sube archivos de hasta 750 KB para mantener el enlace publico estable.");
      return;
    }

    try {
      setUpdatingDocumentId(document.id);
      setMessage("");
      const dataUrl = await readFileAsDataUrl(file);
      await updateClientDocumentFile({
        id: document.id,
        file,
        dataUrl,
      });
      const publicUrl = absolutePublicUrl(getClientDocumentUrl(document.id));
      setMessage(`Archivo actualizado. El enlace publico se mantiene: ${publicUrl}`);
      await refreshDocuments();
    } catch {
      setMessage("No se pudo actualizar el archivo. Verifica permisos de administrador y conexion.");
    } finally {
      setUpdatingDocumentId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        userName={user?.displayName ?? user?.email ?? undefined}
        rightSlot={
          <a
            href="/clientes"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
          >
            <ExternalLink className="h-4 w-4" />
            Ver portal publico
          </a>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <form
          onSubmit={handleUpload}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Subir archivo para cliente</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Publica archivos livianos y comparte un enlace visible sin registro.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Cliente</span>
              <input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                placeholder="Nombre del cliente"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Titulo</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                placeholder="Ej. Estrategia 2026"
              />
            </label>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40">
              <FileUp className="h-7 w-7 text-indigo-600" />
              <span className="mt-3 text-sm font-semibold text-slate-700">
                {selectedFile ? selectedFile.name : "Seleccionar archivo"}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                HTML, PDF o imagen. Maximo recomendado: 750 KB.
              </span>
              <input
                type="file"
                className="sr-only"
                accept=".html,.htm,.pdf,image/*,text/html,application/pdf"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={!canUpload}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.28)] transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Publicar y copiar enlace
          </button>
          {message ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</p> : null}
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Biblioteca de clientes</h2>
              <p className="mt-1 text-sm text-slate-500">Documentos publicados y listos para compartir.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 flex min-h-[260px] items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando archivos...
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
              <div className="min-w-[840px]">
                <div className="grid grid-cols-[1.2fr_0.8fr_110px_220px] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  <span>Documento</span>
                  <span>Cliente</span>
                  <span>Tamano</span>
                  <span className="text-right">Acciones</span>
                </div>
                <div className="divide-y divide-slate-200">
                  {documents.map((document) => {
                    const href = getClientDocumentUrl(document.id);
                    return (
                      <article
                        key={document.id}
                        className="grid grid-cols-[1.2fr_0.8fr_110px_220px] items-center gap-3 px-4 py-4 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{document.title}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{document.fileName}</p>
                        </div>
                      <p className="truncate text-slate-600">{document.clientName}</p>
                      <p className="text-slate-500">{formatSize(document.size)}</p>
                      <div className="flex justify-end gap-2">
                        <label
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition ${
                            document.source === "static" || document.publicPath
                              ? "cursor-not-allowed opacity-45"
                              : "cursor-pointer hover:border-indigo-200 hover:text-indigo-700"
                          }`}
                          aria-label="Actualizar archivo"
                          title="Actualizar archivo"
                        >
                          {updatingDocumentId === document.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <input
                            type="file"
                            className="sr-only"
                            accept=".html,.htm,.pdf,image/*,text/html,application/pdf"
                            disabled={Boolean(
                              updatingDocumentId || document.source === "static" || document.publicPath
                            )}
                            onChange={(event) => {
                              handleReplaceFile(document, event.target.files?.[0] ?? null);
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <button
                          type="button"
                            onClick={() => copyLink(document)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700"
                            aria-label="Copiar enlace publico"
                            title="Copiar enlace publico"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700"
                            aria-label="Abrir enlace publico"
                            title="Abrir enlace publico"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
                      </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
