"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import PageHeader from "@/components/PageHeader";
import ProfileEditor from "@/components/profile/ProfileEditor";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [message, setMessage] = useState<string | null>(null);

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user.displayName} />
      {message ? <p className="text-xs font-semibold text-emerald-700">{message}</p> : null}
      <ProfileEditor
        user={user}
        onSave={(payload) => {
          updateUser(payload);
          setMessage("Perfil actualizado y sincronizado con administración.");
        }}
      />
    </div>
  );
}
