export type Role = "COLLABORATOR" | "ADMIN";

export function mapRole(role?: string): Role {
  return role === "admin" ? "ADMIN" : "COLLABORATOR";
}
