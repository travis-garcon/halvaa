/**
 * Demo/sample fallbacks are opt-in only — never enabled in production by default.
 * Set NEXT_PUBLIC_DEMO_FALLBACK=true to show sample memorials when API data is empty.
 */
export function isDemoFallbackEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_FALLBACK === "true";
}
