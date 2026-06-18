"use client";

import { useSearchParams } from "next/navigation";
import PublicClientDocumentView from "@/components/clients/PublicClientDocumentView";

export default function ClientDocumentQueryView() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? undefined;

  return <PublicClientDocumentView documentId={id} />;
}
