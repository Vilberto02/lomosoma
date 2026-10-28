const API_BASE = import.meta.env.VITE_API_URL || "/api";
let csrfToken: string | null = null;

export interface AccountUser { id: string; email: string; admin: boolean; aal: string }
export interface Session { user: AccountUser | null; csrf_token: string | null }

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(`${API_BASE}${path}`, {
    ...init, headers, credentials: "same-origin", cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(path === "/optimize" ? 90000 : 20000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body.detail === "string" ? body.detail : `No se pudo completar la solicitud (${response.status})`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return response;
}

export async function jsonApi<T>(path: string, body?: unknown): Promise<T> {
  const response = await apiFetch(path, body === undefined ? {} : { method: "POST", body: JSON.stringify(body) });
  return response.json();
}

export async function readSession(): Promise<Session> {
  const session = await jsonApi<Session>("/auth/session");
  csrfToken = session.csrf_token;
  return session;
}

export async function verifyCode(email: string, code: string) {
  const result = await jsonApi<{ csrf_token: string }>("/auth/verify", { email, code });
  csrfToken = result.csrf_token;
}

export async function logout() {
  await apiFetch("/auth/logout", { method: "POST" });
  csrfToken = null;
}
