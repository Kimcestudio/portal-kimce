"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import {
  getClientDocument,
  getClientDocumentOpenUrl,
  getClientDocumentUrl,
  listClientDocuments,
  type ClientDocument,
} from "@/services/clientDocuments";

type Props = {
  documentId?: string;
  showDirectory?: boolean;
};

function formatSize(size: number) {
  if (!size) return "Archivo";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentFrame({ document }: { document: ClientDocument }) {
  const source = document.publicPath ?? document.dataUrl;

  if (!source) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        Este documento aun no tiene archivo adjunto.
      </div>
    );
  }

  if (document.mimeType.startsWith("image/")) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <img src={source} alt={document.title} className="h-auto w-full object-contain" />
      </div>
    );
  }

  return (
    <iframe
      title={document.title}
      src={source}
      className="h-[72vh] min-h-[560px] w-full rounded-2xl border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.12)]"
    />
  );
}

export default function PublicClientDocumentView({ documentId, showDirectory = false }: Props) {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [activeDocument, setActiveDocument] = useState<ClientDocument | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setStatus("loading");
        if (documentId) {
          const document = await getClientDocument(documentId);
          if (!mounted) return;
          setActiveDocument(document);
          setDocuments(document ? [document] : []);
        } else {
          const nextDocuments = await listClientDocuments();
          if (!mounted) return;
          setDocuments(nextDocuments);
          setActiveDocument(nextDocuments[0] ?? null);
        }
        setStatus("ready");
      } catch {
        if (mounted) setStatus("error");
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [documentId]);

  const openUrl = useMemo(() => {
    if (!activeDocument) return "#";
    return getClientDocumentOpenUrl(activeDocument);
  }, [activeDocument]);

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/logo-horizontal-azul.png"
              alt="Kimce Studio"
              width={150}
              height={34}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Portal de clientes</p>
            <p className="text-sm text-slate-500">Acceso publico de solo lectura</p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-6">
        {status === "loading" ? (
          <div className="flex min-h-[520px] items-center justify-center rounded-2xl bg-white text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando documento...
          </div>
        ) : null}

        {status === "error" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            No se pudo cargar el documento publico. Intenta nuevamente en unos segundos.
          </div>
        ) : null}

        {status === "ready" && !activeDocument ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-400" />
            <h1 className="mt-4 text-xl font-semibold">Documento no disponible</h1>
            <p className="mt-2 text-sm text-slate-500">El enlace no existe o fue retirado.</p>
          </div>
        ) : null}

        {status === "ready" && activeDocument ? (
          <div className={`grid gap-5 ${showDirectory ? "lg:grid-cols-[280px_minmax(0,1fr)]" : ""}`}>
            {showDirectory ? (
              <aside className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Documentos</p>
                <div className="mt-3 space-y-2">
                  {documents.map((document) => (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => setActiveDocument(document)}
                      className={`w-full rounded-xl px-3 py-3 text-left transition ${
                        activeDocument.id === document.id
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{document.title}</span>
                      <span className="mt-1 block text-xs">{document.clientName}</span>
                    </button>
                  ))}
                </div>
              </aside>
            ) : null}

            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-indigo-600">{activeDocument.clientName}</p>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{activeDocument.title}</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {activeDocument.fileName} · {formatSize(activeDocument.size)}
                  </p>
                </div>
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir aparte
                </a>
              </div>
              <DocumentFrame document={activeDocument} />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
