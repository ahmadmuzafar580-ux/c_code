import { getToken } from "./token";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export const API_BASE = `${BASE}/api`;
export const WS_URL = BASE.replace(/^http/, "ws") + "/api/ws";

export type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: any;
  auth?: boolean;
};

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = data?.detail || data?.message || `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  return data as T;
}
