import type { CSSProperties } from "react";

export const defaultMemorialTheme: Record<string, string> = {
  "--color-primary": "#FF6B00",
  "--color-background": "#FFFFFF",
  "--color-foreground": "#111111",
  "--color-muted": "#6B7280",
  "--color-border": "#E5E7EB",
};

export const brandTheme: Record<string, string> = {
  "--halvaa-primary": "#FF6B00",
  "--halvaa-primary-soft": "#FFF4EC",
  "--halvaa-bg": "#FFFFFF",
  "--halvaa-surface": "#FAFAFA",
  "--halvaa-text": "#111111",
  "--halvaa-text-muted": "#475569",
  "--halvaa-border": "#E2E8F0",
};

export function memorialThemeStyle(
  overrides?: Record<string, string> | null,
): CSSProperties {
  return {
    ...defaultMemorialTheme,
    ...(overrides ?? {}),
  } as CSSProperties;
}

export function isRtlLocale(locale: string): boolean {
  return locale === "fa" || locale === "ar" || locale === "he";
}
