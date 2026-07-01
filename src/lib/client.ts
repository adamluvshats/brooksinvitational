"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "content-type": "application/json" } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? "Request failed", json.details);
  return json as T;
}

async function send<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? "Request failed", json.details);
  return json as T;
}

export const api = {
  get: fetcher,
  post: <T = unknown>(url: string, body?: unknown) => send<T>("POST", url, body),
  put: <T = unknown>(url: string, body?: unknown) => send<T>("PUT", url, body),
  patch: <T = unknown>(url: string, body?: unknown) => send<T>("PATCH", url, body),
  del: <T = unknown>(url: string) => send<T>("DELETE", url),
};
