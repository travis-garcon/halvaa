"use client";

import useSWR from "swr";

import { api } from "@/lib/api-client";

export function useGuestbook(memorialId: string | undefined) {
  return useSWR(
    memorialId ? ["guestbook", memorialId] : null,
    () => api.guestbook(memorialId!),
    { revalidateOnFocus: false },
  );
}

export async function submitGuestbookEntry(
  memorialId: string,
  payload: {
    author_name: string;
    message: string;
    tribute_type?: "MESSAGE" | "TRIBUTE" | "PRAYER" | "POEM";
    relationship_label?: string | null;
  },
) {
  return api.createGuestbookEntry(memorialId, payload);
}
