"use client";

import { getSupabase } from "@/lib/supabase/client";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function ensureSession({ force = false } = {}) {
  const supabase = getSupabase();

  if (force) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // A missing session is fine; we are about to create a fresh one.
    }
  } else {
    const current = await supabase.auth.getSession();
    if (current.data.session) return current.data.session;
  }

  const created = await supabase.auth.signInAnonymously();
  if (created.error) {
    throw new Error(
      `Could not start a guest session: ${created.error.message}. Make sure Anonymous Sign-Ins are enabled in Supabase.`,
    );
  }

  const again = await supabase.auth.getSession();
  if (!again.data.session) {
    throw new Error("Could not start a guest session.");
  }
  return again.data.session;
}

async function send<T>(
  path: string,
  token: string,
  options: { method?: string; body?: unknown },
): Promise<{ response: Response; payload: T }> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as T;
  return { response, payload };
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  let session = await ensureSession();
  let result = await send<T>(path, session.access_token, options);

  // A stored guest session can outlive its user (for example after an admin
  // cleanup or a project reset). Recover by signing in again once.
  if (result.response.status === 401) {
    session = await ensureSession({ force: true });
    result = await send<T>(path, session.access_token, options);
  }

  const { response, payload } = result;
  if (!response.ok) {
    throw new Error(
      (payload as { error?: string }).error ?? `Request failed (${response.status})`,
    );
  }
  return payload;
}

export function clientErrorMessage(error: unknown): string {
  return message(error);
}
