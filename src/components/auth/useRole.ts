"use client";

import { useOptionalAuth } from "@/components/auth/useAuth";
import { mapRole } from "@/lib/roles";

export default function useRole() {
  const auth = useOptionalAuth();
  return mapRole(auth?.profile?.role ?? auth?.user?.role);
}
