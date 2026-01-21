"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminOverviewPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      Redirigiendo...
    </div>
  );
}
