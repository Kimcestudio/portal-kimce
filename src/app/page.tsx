"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/services/firebase/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    router.replace(user.role === "admin" ? "/admin/overview" : "/app/overview");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      Cargando...
    </div>
  );
}
