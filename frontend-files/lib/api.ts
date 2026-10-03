const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...((opts.headers as Record<string, string>) || {}) };
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  let res: Response;
  try { res = await fetch(BASE + path, { ...opts, headers }); }
  catch { throw new Error("Cannot reach the server. Is the backend running on " + BASE + "?"); }
  if (res.status === 401 && path !== "/auth/login" && path !== "/auth/admin/login") {
    localStorage.removeItem("token");
    window.location.href = "/";
  }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(typeof e.detail === "string" ? e.detail : "Request failed (" + res.status + ")");
  }
  return res.json();
}
