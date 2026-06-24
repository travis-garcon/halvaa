"use client";

import useSWR from "swr";

import { api } from "@/lib/api-client";

export function useCollaboratorInvitations(enabled: boolean) {
  return useSWR(enabled ? ["collaborator-invitations"] : null, () => api.collaboratorInvitations(), {
    revalidateOnFocus: false,
  });
}
