"use client";

import { useOptionalAuth } from "@/components/auth/AuthProvider";
import { mapRole } from "@/lib/roles";

export default function useRole() {
  const auth = useOptionalAuth();
  return mapRole(auth?.user?.role);
}
