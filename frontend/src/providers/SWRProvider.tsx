"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";

import { apiFetch, ApiError } from "@/lib/api-client";

type SWRProviderProps = {
  children: ReactNode;
};

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher: (resource: string) => apiFetch(resource),
        revalidateOnFocus: false,
        dedupingInterval: 10_000,
        errorRetryCount: 2,
        shouldRetryOnError: (error) => {
          if (error instanceof ApiError) {
            return error.status >= 500;
          }
          return true;
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
