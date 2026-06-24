/**
 * Auth storage — session-cookie based via Zitadel OIDC.
 * No localStorage token needed; auth state lives in the HttpOnly session cookie.
 * Kept for backward compat with any code that checks this module.
 */

const TOKEN_KEY = "halvaa_access_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // localStorage not available
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeAccessToken(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyAccessTokenChanged(): void {
  listeners.forEach((fn) => fn());
}
