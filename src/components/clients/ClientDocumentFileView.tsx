"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { getClientDocument, type ClientDocument } from "@/services/clientDocuments";

function FullscreenDocument({ document }: { document: ClientDocument }) {
  const source = document.publicPath ?? document.dataUrl;

  if (!source) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center text-sm text-slate-500">
        <div>
          <FileText className="mx-auto mb-3 h-9 w-9 text-slate-400" />
          Este documento aun no tiene archivo adjunto.
        </div>
      </div>
    );
  }

  if (document.mimeType.startsWith("image/")) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <img src={source} alt={document.title} className="max-h-screen max-w-full object-contain" />
      </main>
    );
  }

  return <iframe title={document.title} src={source} className="h-screen w-screen border-0 bg-white" />;
}

export default function ClientDocumentFileView() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [document, setDocument] = useState<ClientDocument | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!id) {
        setStatus("error");
        return;
      }

      try {
        setStatus("loading");
        const nextDocument = await getClientDocument(id);
        if (!mounted) return;
        setDocument(nextDocument);
        setStatus(nextDocument ? "ready" : "error");
      } catch {
        if (mounted) setStatus("error");
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Cargando archivo...
      </div>
    );
  }

  if (status === "error" || !document) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center text-sm text-slate-500">
        No se pudo abrir este archivo.
      </div>
    );
  }

  return <FullscreenDocument document={document} />;
}
