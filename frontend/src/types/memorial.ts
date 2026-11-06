export type MemorialStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "PUBLISHED"
  | "FEATURED"
  | "DEACTIVATED";

export type FamilyMember = {
  id?: string;
  name: string;
  relation: string;
  years?: string;
};

export type MemorialLocation = {
  kind: string;
  label?: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type MemorialPublic = {
  id: string;
  slug: string;
  status: MemorialStatus;
  birth_date: string | null;
  death_date: string | null;
  burial_address: string | null;
  burial_site_name: string | null;
  burial_plot_name: string | null;
  qr_code_url: string | null;
  translations: Record<string, Record<string, string>>;
  translation_status?: Record<string, unknown>;
  theme_overrides: Record<string, string>;
  family_tree: FamilyMember[];
  category?: string | null;
  metadata?: Record<string, unknown>;
  filter_tags?: Record<string, unknown>;
  locations?: MemorialLocation[];
  is_verified?: boolean;
  verified_at?: string | null;
  view_count?: number;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  featured_at: string | null;
  last_reviewed_at: string | null;
  last_review_decision: string | null;
  last_reviewed_by_id: string | null;
  last_reviewed_by_name: string | null;
};

export type MediaPublic = {
  id: string;
  media_type: "IMAGE" | "VIDEO" | "DOCUMENT";
  category: string;
  mime_type: string;
  file_size_bytes?: number;
  width?: number | null;
  height?: number | null;
  sort_order?: number;
  processing_status?: string;
  translations: Record<string, Record<string, string>>;
  title?: string | null;
  description?: string | null;
  original_url: string;
  thumbnail_url: string | null;
  created_at?: string;
};

export type TimelineEventPublic = {
  id: string;
  event_type: TimelineEventType;
  sort_order: number;
  event_date: string | null;
  translations: Record<string, Record<string, string>>;
  media_id: string | null;
  thumbnail_url: string | null;
};

export type TimelineEventPayload = {
  event_type: TimelineEventType;
  sort_order?: number;
  event_date?: string | null;
  translations: Record<string, Record<string, string>>;
  media_id?: string | null;
};

export type MemorialProfile = MemorialPublic & {
  timeline_events: TimelineEventPublic[];
  gallery: MediaPublic[];
  documents: MediaPublic[];
  artifacts: MediaPublic[];
  guestbook_approved_count: number;
};

export type GeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};

export type GeoJSONFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    id: string;
    slug: string;
    name?: string | null;
    distance_m: number;
    burial_site_name?: string | null;
    burial_plot_name?: string | null;
    image_url?: string | null;
    status?: MemorialStatus;
    is_verified?: boolean;
    view_count?: number;
  };
};

export type GridMemorial = {
  id: string;
  slug: string;
  name: string;
  status?: MemorialStatus;
  burialAddress?: string | null;
  burialSiteName?: string | null;
  burialPlotName?: string | null;
  category?: string | null;
  metadata?: Record<string, unknown>;
  filterTags?: Record<string, unknown>;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
  featuredAt?: string | null;
  isVerified?: boolean;
  viewCount?: number;
  distanceM?: number;
  imageUrl?: string;
};

export type ExploreFeedKind = "featured" | "latest" | "updated";

export type ExploreMemorialFeed = {
  items: Array<{
    id: string;
    slug: string;
    name: string;
    status: MemorialStatus;
    birth_date: string | null;
    death_date: string | null;
    burial_address: string | null;
    burial_site_name: string | null;
    burial_plot_name: string | null;
    category?: string | null;
    metadata?: Record<string, unknown>;
    filter_tags?: Record<string, unknown>;
    latitude: number | null;
    longitude: number | null;
    created_at: string;
    updated_at: string;
    published_at: string | null;
    featured_at: string | null;
    image_url?: string | null;
    is_verified?: boolean;
    view_count?: number;
  }>;
  total?: number;
  limit?: number;
  offset?: number;
  has_more?: boolean;
};

export type MemorialCollaborator = {
  id: string;
  user_id: string;
  memorial_id?: string | null;
  memorial_slug?: string | null;
  memorial_name?: string | null;
  full_name: string;
  email: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  invited_at: string;
  accepted_at: string | null;
};

export type MemorialCollaboratorList = {
  items: MemorialCollaborator[];
};

export type TimelineEventType = "BIOGRAPHY" | "LIFE_EVENT" | "LOCATION";

export type TimelineEvent = {
  id: string;
  eventType: TimelineEventType;
  eventDate?: string;
  title: string;
  body?: string;
  location?: string;
  thumbnailUrl?: string;
};

export type GuestbookEntry = {
  id: string;
  author_name: string;
  message: string;
  tribute_type: "MESSAGE" | "TRIBUTE" | "PRAYER" | "POEM";
  relationship_label: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
  moderated_at: string | null;
  moderated_by_id: string | null;
  moderated_by_name: string | null;
};

export type GuestbookQueueItem = GuestbookEntry & {
  memorial_id: string;
  memorial_slug: string;
  memorial_name: string | null;
};

export type MemorialApprovalQueueItem = {
  id: string;
  slug: string;
  status: MemorialStatus;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  published_at: string | null;
  memorial_name: string | null;
  submitted_by_name: string | null;
  last_reviewed_at: string | null;
  last_review_decision: string | null;
  last_reviewed_by_name: string | null;
};

export type MemorialReviewActivityItem = {
  kind: "MEMORIAL_REVIEW" | "GUESTBOOK_MODERATION";
  created_at: string;
  reviewer_name: string | null;
  decision: string;
  subject_name: string | null;
};
