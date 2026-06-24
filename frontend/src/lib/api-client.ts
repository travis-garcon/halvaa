import { getAccessToken } from "@/lib/auth-storage";
import type { RegisterPayload, TokenResponse, UserPublic } from "@/types/auth";
import type {
  ExploreFeedKind,
  ExploreMemorialFeed,
  GeoJSONFeatureCollection,
  GuestbookEntry,
  GuestbookQueueItem,
  MediaPublic,
  MemorialApprovalQueueItem,
  MemorialCollaborator,
  MemorialCollaboratorList,
  MemorialProfile,
  MemorialPublic,
  MemorialReviewActivityItem,
  TimelineEventPayload,
  TimelineEventPublic,
} from "@/types/memorial";

export type MemorialCreatePayload = {
  slug: string;
  birth_date?: string | null;
  death_date?: string | null;
  burial_address?: string | null;
  burial_site_name?: string | null;
  burial_plot_name?: string | null;
  qr_code_url?: string | null;
  translations?: Record<string, Record<string, string>>;
  theme_overrides?: Record<string, string>;
  family_tree?: Array<{ name: string; relation: string; years?: string }>;
  latitude?: number | null;
  longitude?: number | null;
};

export type MemorialUpdatePayload = Partial<MemorialCreatePayload> & {
  status?: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "FEATURED";
};

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ApiFetchOptions = RequestInit & {
  auth?: boolean;
};

export function buildApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { auth = false, headers, ...rest } = options;
  const requestHeaders = new Headers(headers);

  const isFormData = typeof FormData !== "undefined" && rest.body instanceof FormData;
  if (!requestHeaders.has("Content-Type") && rest.body && !isFormData) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = getAccessToken();
    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(buildApiUrl(path), {
    ...rest,
    headers: requestHeaders,
    credentials: "include",
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as {
        detail?: string | Array<{ msg?: string; loc?: unknown[] }>;
      };
      if (typeof payload.detail === "string") {
        detail = payload.detail;
      } else if (Array.isArray(payload.detail)) {
        detail = payload.detail
          .map((item) => item.msg ?? JSON.stringify(item))
          .join("; ");
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) => {
    const body = new URLSearchParams();
    body.set("username", email);
    body.set("password", password);
    return apiFetch<TokenResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  },

  register: (payload: RegisterPayload) =>
    apiFetch<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: () => apiFetch<UserPublic>("/auth/me", { auth: true }),

  createMemorial: (payload: MemorialCreatePayload) =>
    apiFetch<MemorialPublic>("/memorials", {
      method: "POST",
      auth: true,
      body: JSON.stringify(payload),
    }),

  myMemorials: () => apiFetch<MemorialPublic[]>("/memorials/mine", { auth: true }),

  nearbyMemorials: (params: {
    latitude: number;
    longitude: number;
    radiusM?: number;
    locale?: string;
  }) => {
    const search = new URLSearchParams({
      latitude: String(params.latitude),
      longitude: String(params.longitude),
      radius_m: String(params.radiusM ?? 5000),
      locale: params.locale ?? "en",
    });
    return apiFetch<GeoJSONFeatureCollection>(`/explore/nearby?${search}`);
  },

  discoverMemorials: (params: {
    kind: ExploreFeedKind;
    locale?: string;
    limit?: number;
  }) => {
    const search = new URLSearchParams({
      kind: params.kind,
      locale: params.locale ?? "en",
      limit: String(params.limit ?? 12),
    });
    return apiFetch<ExploreMemorialFeed>(`/explore/discover?${search}`);
  },

  memorialBySlug: (slug: string, auth = false) =>
    apiFetch<MemorialProfile>(`/memorials/slug/${slug}`, { auth }),

  updateMemorial: (id: string, payload: MemorialUpdatePayload) =>
    apiFetch<MemorialPublic>(`/memorials/${id}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify(payload),
    }),

  updateMemorialStatus: (id: string, status: MemorialUpdatePayload["status"]) =>
    apiFetch<MemorialPublic>(`/memorials/${id}/status`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ status }),
    }),

  memorialReviewHistory: (id: string, limit = 10) =>
    apiFetch<MemorialReviewActivityItem[]>(`/memorials/${id}/review-history?limit=${limit}`, {
      auth: true,
    }),

  createTimelineEvent: (memorialId: string, payload: TimelineEventPayload) =>
    apiFetch<TimelineEventPublic>(`/memorials/${memorialId}/timeline`, {
      method: "POST",
      auth: true,
      body: JSON.stringify(payload),
    }),

  updateTimelineEvent: (memorialId: string, eventId: string, payload: Partial<TimelineEventPayload>) =>
    apiFetch<TimelineEventPublic>(`/memorials/${memorialId}/timeline/${eventId}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify(payload),
    }),

  deleteTimelineEvent: (memorialId: string, eventId: string) =>
    apiFetch<void>(`/memorials/${memorialId}/timeline/${eventId}`, {
      method: "DELETE",
      auth: true,
    }),

  uploadMedia: (memorialId: string, file: File, category = "GALLERY") => {
    const body = new FormData();
    body.set("file", file);
    body.set("category", category);
    return apiFetch<MediaPublic>(`/memorials/${memorialId}/media`, {
      method: "POST",
      auth: true,
      body,
    });
  },

  collaborators: (memorialId: string) =>
    apiFetch<MemorialCollaboratorList>(`/memorials/${memorialId}/collaborators`, {
      auth: true,
    }),

  inviteCollaborator: (memorialId: string, payload: { email: string; role: MemorialCollaborator["role"] }) =>
    apiFetch<MemorialCollaborator>(`/memorials/${memorialId}/collaborators`, {
      method: "POST",
      auth: true,
      body: JSON.stringify(payload),
    }),

  collaboratorInvitations: () =>
    apiFetch<MemorialCollaboratorList>("/collaborators/invitations", {
      auth: true,
    }),

  acceptCollaboratorInvitation: (collaboratorId: string) =>
    apiFetch<MemorialCollaborator>(`/collaborators/${collaboratorId}/accept`, {
      method: "POST",
      auth: true,
    }),

  declineCollaboratorInvitation: (collaboratorId: string) =>
    apiFetch<void>(`/collaborators/${collaboratorId}`, {
      method: "DELETE",
      auth: true,
    }),

  removeCollaborator: (memorialId: string, collaboratorId: string) =>
    apiFetch<void>(`/memorials/${memorialId}/collaborators/${collaboratorId}`, {
      method: "DELETE",
      auth: true,
    }),

  updateCollaborator: (memorialId: string, collaboratorId: string, role: MemorialCollaborator["role"]) =>
    apiFetch<MemorialCollaborator>(`/memorials/${memorialId}/collaborators/${collaboratorId}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ role }),
    }),

  resendCollaboratorInvitation: (memorialId: string, collaboratorId: string) =>
    apiFetch<MemorialCollaborator>(`/memorials/${memorialId}/collaborators/${collaboratorId}/resend`, {
      method: "POST",
      auth: true,
    }),

  media: (memorialId: string) =>
    apiFetch<MediaPublic[]>(`/memorials/${memorialId}/media`, { auth: true }),

  updateMediaCategory: (memorialId: string, mediaId: string, category: string) => {
    return apiFetch<MediaPublic>(`/memorials/${memorialId}/media/${mediaId}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ category }),
    });
  },

  updateMedia: (memorialId: string, mediaId: string, payload: { category?: string; sort_order?: number; translations?: Record<string, Record<string, string>>; title?: string | null; description?: string | null }) =>
    apiFetch<MediaPublic>(`/memorials/${memorialId}/media/${mediaId}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify(payload),
    }),

  deleteMedia: (memorialId: string, mediaId: string) =>
    apiFetch<void>(`/memorials/${memorialId}/media/${mediaId}`, {
      method: "DELETE",
      auth: true,
    }),

  pendingGuestbook: (memorialId: string) =>
    apiFetch<GuestbookEntry[]>(`/memorials/${memorialId}/guestbook/pending`, {
      auth: true,
    }),

  pendingGuestbookQueue: (locale = "en") =>
    apiFetch<GuestbookQueueItem[]>(`/guestbook/pending?${new URLSearchParams({ locale })}`, {
      auth: true,
    }),

  pendingMemorialApprovals: (locale = "en") =>
    apiFetch<MemorialApprovalQueueItem[]>(`/memorials/pending-approvals?${new URLSearchParams({ locale })}`, {
      auth: true,
    }),

  reviewMemorial: (memorialId: string, decision: "APPROVE" | "REQUEST_CHANGES" | "FEATURE") =>
    apiFetch<MemorialPublic>(`/memorials/${memorialId}/review`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ decision }),
    }),

  moderateGuestbookEntry: (memorialId: string, entryId: string, status: "APPROVED" | "REJECTED") =>
    apiFetch<GuestbookEntry>(`/memorials/${memorialId}/guestbook/${entryId}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ status }),
    }),

  guestbook: (memorialId: string) =>
    apiFetch<GuestbookEntry[]>(`/memorials/${memorialId}/guestbook`),

  createGuestbookEntry: (
    memorialId: string,
    payload: {
      author_name: string;
      message: string;
      tribute_type?: "MESSAGE" | "TRIBUTE" | "PRAYER" | "POEM";
      relationship_label?: string | null;
    },
  ) =>
    apiFetch<GuestbookEntry>(`/memorials/${memorialId}/guestbook`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
