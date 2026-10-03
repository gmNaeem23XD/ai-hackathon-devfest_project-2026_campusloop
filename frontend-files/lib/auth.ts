export type UserRole = "STUDENT" | "TEACHER" | "ADMIN";

export function homeForRole(role: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "TEACHER") return "/teacher";
  if (role === "STUDENT") return "/student";
  return "/";
}
