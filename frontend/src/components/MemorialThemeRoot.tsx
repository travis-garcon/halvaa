import type { ReactNode } from "react";

import { memorialThemeStyle } from "@/lib/theme";

type MemorialThemeRootProps = {
  children: ReactNode;
  themeOverrides?: Record<string, string> | null;
  className?: string;
};

export function MemorialThemeRoot({
  children,
  themeOverrides,
  className = "",
}: MemorialThemeRootProps) {
  return (
    <div
      className={`memorial-theme-root ${className}`.trim()}
      style={memorialThemeStyle(themeOverrides)}
    >
      {children}
    </div>
  );
}
