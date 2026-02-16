type UserAvatarProps = {
  name?: string;
  photoURL?: string | null;
  avatarUrl?: string | null;
  profilePhoto?: string | null;
  sizeClassName?: string;
};

const getInitials = (name?: string) => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
};

export default function UserAvatar({
  name,
  photoURL,
  avatarUrl,
  profilePhoto,
  sizeClassName = "h-8 w-8",
}: UserAvatarProps) {
  const src = photoURL || avatarUrl || profilePhoto || "";
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? "Usuario"}
        className={`${sizeClassName} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`flex ${sizeClassName} items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600`}
      aria-label={name ?? "Usuario"}
    >
      {getInitials(name)}
    </div>
  );
}
