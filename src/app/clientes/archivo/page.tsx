import { Suspense } from "react";
import ClientDocumentFileView from "@/components/clients/ClientDocumentFileView";

export default function ClientDocumentFilePage() {
  return (
    <Suspense fallback={null}>
      <ClientDocumentFileView />
    </Suspense>
  );
}
