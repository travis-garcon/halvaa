import { getAccessToken } from "@/lib/auth-storage";
import type { OtpStartPayload, OtpStartResponse, RegisterPayload, TokenResponse, UserPublic, UserUpdatePayload } from "@/types/auth";
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
  slug?: string | null;
  status?: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "FEATURED" | "DEACTIVATED";
  birth_date?: string | null;
  death_date?: string | null;
  burial_address?: string | null;
  burial_site_name?: string | null;
  burial_plot_name?: string | null;
  qr_code_url?: string | null;
  translations?: Record<string, Record<string, string>>;
  translation_status?: Record<string, unknown>;
  theme_overrides?: Record<string, string>;
  family_tree?: Array<{ name: string; relation: string; years?: string }>;
  category?: string | null;
  metadata?: Record<string, unknown>;
  filter_tags?: Record<string, unknown>;
  locations?: Array<Record<string, unknown>>;
  latitude?: number | null;
  longitude?: number | null;
};

export type StoreItemPublic = {
  id: string;
  key: string;
  kind: string;
  title: Record<string, string>;
  description: Record<string, string>;
  price_usd_cents: number;
  price_irr: number;
  item_metadata: Record<string, unknown>;
};

export type CheckoutResponse = {
  provider: "STRIPE" | "ZARINPAL" | string;
  purchase_id: string;
  amount: number;
  currency: string;
  checkout_url: string;
  provider_reference?: string | null;
  test_mode?: boolean;
};

export type PaymentVerifyResponse = {
  purchase_id: string;
  status: string;
  provider: string;
  provider_reference?: string | null;
  message: string;
};

export type AdminKpis = {
  users: number;
  memorials: number;
  published_memorials: number;
  guestbook_entries: number;
  income_usd_cents: number;
  income_irr: number;
};

export type AdminLandingPlacement = {
  id: string;
  memorial_id: string;
  category: string;
  sort_order: number;
  label?: string | null;
  is_active: boolean;
  memorial_slug: string;
  memorial_name?: string | null;
  created_at: string;
};

export type ContributionPublic = {
  id: string;
  memorial_id: string;
  contributor_id: string;
  contributor_name?: string | null;
  contribution_type: string;
  status: string;
  payload: Record<string, unknown>;
  reviewer_note?: string | null;
  created_at: string;
  updated_at: string;
};

export type MemorialUpdatePayload = Partial<MemorialCreatePayload> & {
  status?: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "FEATURED" | "DEACTIVATED";
};

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

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
  return `${API_BASE_URL.replace(/\/$/, "")}${normalized}`;
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

function uploadFormData<T>(path: string, body: FormData, onProgress?: (progress: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", buildApiUrl(path));
    request.withCredentials = true;
    const token = getAccessToken();
    if (token) request.setRequestHeader("Authorization", `Bearer ${token}`);

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        try {
          resolve(JSON.parse(request.responseText) as T);
        } catch {
          reject(new ApiError("Invalid upload response", request.status));
        }
        return;
      }
      let message = `Request failed (${request.status})`;
      try {
        const payload = JSON.parse(request.responseText) as { detail?: string };
        if (payload.detail) message = payload.detail;
      } catch {
        // Keep the generic request error.
      }
      reject(new ApiError(message, request.status));
    });
    request.addEventListener("error", () => reject(new ApiError("Upload failed", 0)));
    request.addEventListener("abort", () => reject(new ApiError("Upload canceled", 0)));
    request.send(body);
  });
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

  startOtp: (payload: OtpStartPayload) =>
    apiFetch<OtpStartResponse>("/auth/otp/start", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  verifyOtp: (otpId: string, code: string) =>
    apiFetch<TokenResponse>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ otp_id: otpId, code }),
    }),

  me: () => apiFetch<UserPublic>("/auth/me", { auth: true }),

  updateMe: (payload: UserUpdatePayload) =>
    apiFetch<UserPublic>("/auth/me", {
      method: "PATCH",
      auth: true,
      body: JSON.stringify(payload),
    }),

  uploadMyAvatar: (file: File, onProgress?: (progress: number) => void) => {
    const body = new FormData();
    body.set("file", file);
    return uploadFormData<UserPublic>("/auth/me/avatar", body, onProgress);
  },

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
    q?: string;
    limit?: number;
  }) => {
    const search = new URLSearchParams({
      latitude: String(params.latitude),
      longitude: String(params.longitude),
      radius_m: String(params.radiusM ?? 5000),
      locale: params.locale ?? "en",
      limit: String(params.limit ?? 30),
      data_v: "2",
    });
    if (params.q?.trim()) {
      search.set("q", params.q.trim());
    }
    return apiFetch<GeoJSONFeatureCollection>(`/explore/nearby?${search}`, { cache: "no-store" });
  },

  discoverMemorials: (params: {
    kind: ExploreFeedKind;
    locale?: string;
    limit?: number;
    offset?: number;
    q?: string;
  }) => {
    const search = new URLSearchParams({
      kind: params.kind,
      locale: params.locale ?? "en",
      limit: String(params.limit ?? 30),
      offset: String(params.offset ?? 0),
      data_v: "2",
    });
    if (params.q?.trim()) {
      search.set("q", params.q.trim());
    }
    return apiFetch<ExploreMemorialFeed>(`/explore/discover?${search}`, { cache: "no-store" });
  },

  memorialBySlug: (slug: string, auth = false) =>
    apiFetch<MemorialProfile>(`/memorials/slug/${slug}`, { auth }),

  recordMemorialView: (memorialId: string) =>
    apiFetch<void>(`/memorials/${memorialId}/view`, { method: "POST" }),

  updateMemorial: (id: string, payload: MemorialUpdatePayload) =>
    apiFetch<MemorialPublic>(`/memorials/${id}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify(payload),
    }),

  deleteMemorial: (id: string) =>
    apiFetch<void>(`/memorials/${id}`, {
      method: "DELETE",
      auth: true,
    }),

  updateMemorialStatus: (id: string, status: MemorialUpdatePayload["status"]) =>
    apiFetch<MemorialPublic>(`/memorials/${id}/status`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ status }),
    }),

  translateMemorial: (id: string, payload: { source_locale?: string | null; target_locales?: string[] }) =>
    apiFetch<MemorialPublic>(`/memorials/${id}/translate`, {
      method: "POST",
      auth: true,
      body: JSON.stringify(payload),
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

  uploadMedia: (memorialId: string, file: File, category = "GALLERY", onProgress?: (progress: number) => void) => {
    const body = new FormData();
    body.set("file", file);
    body.set("category", category);
    return uploadFormData<MediaPublic>(`/memorials/${memorialId}/media`, body, onProgress);
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

  storeItems: () => apiFetch<StoreItemPublic[]>("/store/items"),

  createCheckout: (payload: { store_item_id: string; memorial_id?: string | null; locale?: string; country_code?: string | null; provider?: "STRIPE" | "ZARINPAL" | "CRYPTO" }) =>
    apiFetch<CheckoutResponse>("/store/checkout", {
      method: "POST",
      auth: true,
      body: JSON.stringify(payload),
    }),

  completeCheckoutForDevelopment: (purchaseId: string) =>
    apiFetch<PaymentVerifyResponse>(`/store/checkout/${purchaseId}/manual-complete`, {
      method: "POST",
      auth: true,
    }),

  adminKpis: () => apiFetch<AdminKpis>("/admin/kpis", { auth: true }),
  adminLandingPlacements: (locale = "en") =>
    apiFetch<AdminLandingPlacement[]>(`/admin/landing-placements?${new URLSearchParams({ locale })}`, { auth: true }),

  landingFeed: (locale = "en") =>
    apiFetch<{ categories: Array<{ category: string; label?: string | null; items: ExploreMemorialFeed["items"] }> }>(`/explore/landing?${new URLSearchParams({ locale, data_v: "2" })}`, { cache: "no-store" }),

  createContribution: (
    memorialId: string,
    payload: { locale: string; name?: string | null; biography?: string | null; epitaph?: string | null; source_note?: string | null },
  ) =>
    apiFetch<ContributionPublic>(`/memorials/${memorialId}/contributions`, {
      method: "POST",
      auth: true,
      body: JSON.stringify({ contribution_type: "PROFILE_TEXT", ...payload }),
    }),

  reviewContribution: (memorialId: string, contributionId: string, decision: "APPROVE" | "REJECT", reviewer_note?: string | null) =>
    apiFetch<ContributionPublic>(`/memorials/${memorialId}/contributions/${contributionId}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ decision, reviewer_note }),
    }),
};
