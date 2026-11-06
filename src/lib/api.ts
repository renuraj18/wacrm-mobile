import { API_BASE_URL } from "./config";
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

/** Shown when the CRM rejects the bearer token — usually because the
 *  server change that accepts mobile tokens isn't deployed yet. */
export const SERVER_NOT_UPDATED =
  "The CRM server didn't accept the app's sign-in (401). It probably hasn't been updated for the mobile app yet — ask your admin to deploy the latest CRM version.";

/**
 * Call the wacrm Next.js API with the Supabase access token as a bearer
 * token. Throws ApiError with the server's `error` message on failure.
 */
export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new ApiError("You're signed out. Please sign in again.", 401);

  const qs = init.query ? `?${new URLSearchParams(init.query)}` : "";
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}${qs}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("Couldn't reach the CRM server. Check your internet connection.", 0);
  }

  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (res.status === 401) throw new ApiError(SERVER_NOT_UPDATED, 401, data.code);
  if (!res.ok) throw new ApiError(data.error || `Request failed (HTTP ${res.status})`, res.status, data.code);
  return data as T;
}
