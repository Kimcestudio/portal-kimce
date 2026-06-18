import { Suspense } from "react";
import ClientDocumentQueryView from "@/components/clients/ClientDocumentQueryView";

export default function ClientDocumentQueryPage() {
  return (
    <Suspense fallback={null}>
      <ClientDocumentQueryView />
    </Suspense>
  );
}
