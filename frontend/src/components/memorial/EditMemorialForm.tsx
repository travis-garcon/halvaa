"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useLocale, useTranslations } from "next-intl";

import { useAuth } from "@/hooks/use-auth";
import { Link } from "@/i18n/routing";
import { api, ApiError } from "@/lib/api-client";
import type { FamilyMember, MemorialCollaborator, MemorialReviewActivityItem, TimelineEventPublic, TimelineEventType } from "@/types/memorial";

type EditMemorialFormProps = {
  slug: string;
};

const MEDIA_CATEGORIES = ["GALLERY", "DOCUMENT", "WILL"] as const;
const TIMELINE_MEDIA_CATEGORY = "TIMELINE" as const;

function getMediaLabel(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const fileName = pathname.split("/").pop();
    return fileName && fileName.length > 0 ? decodeURIComponent(fileName) : url;
  } catch {
    return url;
  }
}

function getMediaMeta(item: { translations: Record<string, Record<string, string>> }) {
  const meta = item.translations?.meta ?? {};
  return {
    assetKind: meta.asset_kind,
  };
}

function buildPublicMemorialUrl(slug: string, locale: string): string {
  const path = `/${locale}/memorial/${slug}`;
  if (typeof window === "undefined") {
    return path;
  }
  return new URL(path, window.location.origin).toString();
}

function buildQrImageUrl(targetUrl: string): string {
  const search = new URLSearchParams({
    size: "512x512",
    data: targetUrl,
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${search}`;
}

function getReviewActivityLabel(item: MemorialReviewActivityItem, t: ReturnType<typeof useTranslations>) {
  if (item.kind === "MEMORIAL_REVIEW") {
    return t("reviewActivityMemorial", {
      decision: t(`reviewDecisions.${item.decision}`),
      subject: item.subject_name ?? t("reviewActivityFallbackSubject"),
    });
  }

  return t("reviewActivityGuestbook", {
    decision: t(`guestbookReviewDecisions.${item.decision}`),
    subject: item.subject_name ?? t("reviewActivityFallbackSubject"),
  });
}

export function EditMemorialForm({ slug }: EditMemorialFormProps) {
  const t = useTranslations("editMemorial");
  const tCommon = useTranslations("common");
  const tTimeline = useTranslations("timeline");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: memorial, isLoading, mutate: mutateMemorial } = useSWR(isAuthenticated ? ["edit-memorial", slug] : null, () => api.memorialBySlug(slug, true));
  const { data: collaborators, mutate: mutateCollaborators } = useSWR(
    memorial ? ["memorial-collaborators", memorial.id] : null,
    () => api.collaborators(memorial!.id),
  );
  const { data: mediaItems = [], mutate: mutateMedia } = useSWR(
    memorial ? ["memorial-media", memorial.id] : null,
    () => api.media(memorial!.id),
  );
  const { data: pendingGuestbook = [], mutate: mutatePendingGuestbook } = useSWR(
    memorial ? ["pending-guestbook", memorial.id] : null,
    () => api.pendingGuestbook(memorial!.id),
  );
  const { data: reviewHistory = [] } = useSWR(
    memorial ? ["memorial-review-history", memorial.id] : null,
    () => api.memorialReviewHistory(memorial!.id),
  );
  const isOwner = (collaborators?.items ?? []).some((collaborator) => collaborator.user_id === user?.id && collaborator.role === "OWNER");
  const libraryMediaItems = mediaItems.filter((item) => item.category !== TIMELINE_MEDIA_CATEGORY);
  const timelineMediaItems = mediaItems.filter((item) => item.category === TIMELINE_MEDIA_CATEGORY);

  const [name, setName] = useState("");
  const [biography, setBiography] = useState("");
  const [epitaph, setEpitaph] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [burialSiteName, setBurialSiteName] = useState("");
  const [burialPlotName, setBurialPlotName] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [familyTree, setFamilyTree] = useState<FamilyMember[]>([]);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("GALLERY");
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [collaboratorRole, setCollaboratorRole] = useState<MemorialCollaborator["role"]>("EDITOR");
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [moderatingEntryId, setModeratingEntryId] = useState<string | null>(null);
  const [removingCollaboratorId, setRemovingCollaboratorId] = useState<string | null>(null);
  const [updatingCollaboratorId, setUpdatingCollaboratorId] = useState<string | null>(null);
  const [resendingCollaboratorId, setResendingCollaboratorId] = useState<string | null>(null);
  const [removingMediaId, setRemovingMediaId] = useState<string | null>(null);
  const [updatingMediaId, setUpdatingMediaId] = useState<string | null>(null);
  const [timelineEventId, setTimelineEventId] = useState<string | null>(null);
  const [timelineTitle, setTimelineTitle] = useState("");
  const [timelineBody, setTimelineBody] = useState("");
  const [timelineLocation, setTimelineLocation] = useState("");
  const [timelineDate, setTimelineDate] = useState("");
  const [timelineType, setTimelineType] = useState<TimelineEventType>("LIFE_EVENT");
  const [timelineMediaId, setTimelineMediaId] = useState("");
  const [timelineSortOrder, setTimelineSortOrder] = useState("0");
  const [savingTimeline, setSavingTimeline] = useState(false);
  const [deletingTimelineId, setDeletingTimelineId] = useState<string | null>(null);
  const [timelineMessage, setTimelineMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetTimelineForm = () => {
    setTimelineEventId(null);
    setTimelineTitle("");
    setTimelineBody("");
    setTimelineLocation("");
    setTimelineDate("");
    setTimelineType("LIFE_EVENT");
    setTimelineMediaId("");
    setTimelineSortOrder("0");
  };

  useEffect(() => {
    if (!memorial) return;
    const translation = memorial.translations?.[locale] ?? memorial.translations?.en ?? {};
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(translation.name ?? "");
    setBiography(translation.biography ?? "");
    setEpitaph(translation.epitaph ?? "");
    setAnnouncement(translation.announcement ?? "");
    setBirthDate(memorial.birth_date ?? "");
    setDeathDate(memorial.death_date ?? "");
    setBurialSiteName(memorial.burial_site_name ?? "");
    setBurialPlotName(memorial.burial_plot_name ?? "");
    setQrCodeUrl(memorial.qr_code_url ?? "");
    setFamilyTree(memorial.family_tree ?? []);
    setLatitude(memorial.latitude?.toString() ?? "");
    setLongitude(memorial.longitude?.toString() ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [locale, memorial]);

  const buildMemorialPayload = () => {
    if (!memorial) {
      return null;
    }

    return {
      birth_date: birthDate || null,
      death_date: deathDate || null,
      burial_site_name: burialSiteName.trim() || null,
      burial_plot_name: burialPlotName.trim() || null,
      qr_code_url: qrCodeUrl.trim() || null,
      family_tree: familyTree.filter((member) => member.name.trim() && member.relation.trim()),
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      translations: {
        ...memorial.translations,
        [locale]: {
          name: name.trim(),
          ...(biography.trim() ? { biography: biography.trim() } : {}),
          ...(epitaph.trim() ? { epitaph: epitaph.trim() } : {}),
          ...(announcement.trim() ? { announcement: announcement.trim() } : {}),
        },
      },
    };
  };

  const persistMemorialDetails = async () => {
    if (!memorial) {
      return null;
    }
    const payload = buildMemorialPayload();
    if (!payload) {
      return null;
    }
    return api.updateMemorial(memorial.id, payload);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!memorial) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      await persistMemorialDetails();
      await mutateMemorial();
      setSaveMessage(t("saveSuccess"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  };

  const handleWorkflowAction = async (action: "submit" | "feature") => {
    if (!memorial) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      await persistMemorialDetails();
      if (action === "submit") {
        await api.updateMemorialStatus(memorial.id, "PENDING_APPROVAL");
        setSaveMessage(t("submitSuccess"));
      } else {
        await api.updateMemorialStatus(memorial.id, "FEATURED");
        setSaveMessage(t("featureSuccess"));
      }
      await mutateMemorial();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : action === "submit" ? t("submitError") : t("featureError"));
    } finally {
      setSaving(false);
    }
  };

  const updateFamilyMember = (index: number, next: Partial<FamilyMember>) => {
    setFamilyTree((current) => current.map((member, currentIndex) => (currentIndex === index ? { ...member, ...next } : member)));
  };

  const addFamilyMember = () => {
    setFamilyTree((current) => [...current, { name: "", relation: "", years: "" }]);
  };

  const removeFamilyMember = (index: number) => {
    setFamilyTree((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleUpload = async (file: File | null, category = uploadCategory) => {
    if (!file || !memorial) return;
    setUploading(true);
    setUploadMessage(null);
    setError(null);
    try {
      await api.uploadMedia(memorial.id, file, category);
      setUploadMessage(t("uploadSuccess"));
      await mutateMedia();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const handleInviteCollaborator = async () => {
    if (!memorial) return;
    if (!collaboratorEmail.trim()) {
      setError(t("collaboratorEmailRequired"));
      return;
    }
    setInviting(true);
    setInviteMessage(null);
    setError(null);

    try {
      await api.inviteCollaborator(memorial.id, { email: collaboratorEmail.trim(), role: collaboratorRole });
      setCollaboratorEmail("");
      setCollaboratorRole("EDITOR");
      setInviteMessage(t("collaboratorInviteSuccess"));
      await mutateCollaborators();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("collaboratorInviteError"));
    } finally {
      setInviting(false);
    }
  };

  const handleModerateGuestbook = async (entryId: string, nextStatus: "APPROVED" | "REJECTED") => {
    if (!memorial) return;
    setModeratingEntryId(entryId);
    setError(null);

    try {
      await api.moderateGuestbookEntry(memorial.id, entryId, nextStatus);
      await mutatePendingGuestbook();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("guestbookModerationError"));
    } finally {
      setModeratingEntryId(null);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!memorial) return;
    setRemovingCollaboratorId(collaboratorId);
    setInviteMessage(null);
    setError(null);

    try {
      await api.removeCollaborator(memorial.id, collaboratorId);
      setInviteMessage(t("collaboratorRemoveSuccess"));
      await mutateCollaborators();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("collaboratorRemoveError"));
    } finally {
      setRemovingCollaboratorId(null);
    }
  };

  const handleUpdateCollaboratorRole = async (collaboratorId: string, role: MemorialCollaborator["role"]) => {
    if (!memorial) return;
    setUpdatingCollaboratorId(collaboratorId);
    setInviteMessage(null);
    setError(null);

    try {
      await api.updateCollaborator(memorial.id, collaboratorId, role);
      setInviteMessage(t("collaboratorRoleSuccess"));
      await mutateCollaborators();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("collaboratorRoleError"));
    } finally {
      setUpdatingCollaboratorId(null);
    }
  };

  const handleResendCollaboratorInvitation = async (collaboratorId: string) => {
    if (!memorial) return;
    setResendingCollaboratorId(collaboratorId);
    setInviteMessage(null);
    setError(null);

    try {
      await api.resendCollaboratorInvitation(memorial.id, collaboratorId);
      setInviteMessage(t("collaboratorResendSuccess"));
      await mutateCollaborators();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("collaboratorResendError"));
    } finally {
      setResendingCollaboratorId(null);
    }
  };

  const handleGenerateQrCode = () => {
    if (!memorial) return;
    const publicUrl = buildPublicMemorialUrl(memorial.slug, locale);
    setQrCodeUrl(buildQrImageUrl(publicUrl));
  };

  const handleRemoveMedia = async (mediaId: string) => {
    if (!memorial) return;
    setRemovingMediaId(mediaId);
    setUploadMessage(null);
    setError(null);

    try {
      await api.deleteMedia(memorial.id, mediaId);
      setUploadMessage(t("mediaRemoveSuccess"));
      await mutateMedia();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("mediaRemoveError"));
    } finally {
      setRemovingMediaId(null);
    }
  };

  const handleUpdateMediaCategory = async (mediaId: string, category: string) => {
    if (!memorial) return;
    setUpdatingMediaId(mediaId);
    setUploadMessage(null);
    setError(null);

    try {
      await api.updateMediaCategory(memorial.id, mediaId, category);
      setUploadMessage(t("mediaCategorySuccess"));
      await mutateMedia();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("mediaCategoryError"));
    } finally {
      setUpdatingMediaId(null);
    }
  };

  const handleEditMediaDetails = async (mediaId: string) => {
    if (!memorial) return;
    const item = mediaItems.find((entry) => entry.id === mediaId);
    if (!item) return;

    const nextTitle = window.prompt(t("mediaTitlePrompt"), item.title ?? "");
    if (nextTitle === null) return;
    const nextDescription = window.prompt(t("mediaDescriptionPrompt"), item.description ?? "");
    if (nextDescription === null) return;

    setUpdatingMediaId(mediaId);
    setError(null);
    try {
      await api.updateMedia(memorial.id, mediaId, {
        title: nextTitle.trim() || null,
        description: nextDescription.trim() || null,
      });
      setUploadMessage(t("mediaDetailsSuccess"));
      await mutateMedia();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("mediaDetailsError"));
    } finally {
      setUpdatingMediaId(null);
    }
  };

  const handleToggleArtifact = async (mediaId: string) => {
    if (!memorial) return;
    const item = mediaItems.find((entry) => entry.id === mediaId);
    if (!item) return;

    const meta = getMediaMeta(item);
    const nextTranslations = {
      ...item.translations,
      meta: {
        ...item.translations.meta,
        ...(meta.assetKind === "ARTIFACT" ? {} : { asset_kind: "ARTIFACT" }),
      },
    };
    if (meta.assetKind === "ARTIFACT" && nextTranslations.meta) {
      delete nextTranslations.meta.asset_kind;
    }

    setUpdatingMediaId(mediaId);
    setError(null);
    try {
      await api.updateMedia(memorial.id, mediaId, {
        translations: nextTranslations,
      });
      setUploadMessage(meta.assetKind === "ARTIFACT" ? t("artifactUnsetSuccess") : t("artifactSetSuccess"));
      await mutateMedia();
      await mutateMemorial();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("artifactToggleError"));
    } finally {
      setUpdatingMediaId(null);
    }
  };

  const handleEditTimelineEvent = (event: TimelineEventPublic) => {
    const translation = event.translations?.[locale] ?? event.translations?.en ?? {};
    setTimelineEventId(event.id);
    setTimelineTitle(translation.title ?? translation.name ?? "");
    setTimelineBody(translation.body ?? translation.description ?? "");
    setTimelineLocation(translation.location ?? "");
    setTimelineDate(event.event_date ?? "");
    setTimelineType(event.event_type);
    setTimelineMediaId(event.media_id ?? "");
    setTimelineSortOrder(String(event.sort_order ?? 0));
    setTimelineMessage(null);
    setError(null);
  };

  const handleSaveTimelineEvent = async () => {
    if (!memorial || !timelineTitle.trim()) {
      setError(t("timelineTitleRequired"));
      return;
    }
    setSavingTimeline(true);
    setTimelineMessage(null);
    setError(null);

    const payload = {
      event_type: timelineType,
      sort_order: Number(timelineSortOrder || 0),
      event_date: timelineDate || null,
      media_id: timelineMediaId || null,
      translations: {
        [locale]: {
          title: timelineTitle.trim(),
          ...(timelineBody.trim() ? { body: timelineBody.trim() } : {}),
          ...(timelineLocation.trim() ? { location: timelineLocation.trim() } : {}),
        },
      },
    };

    try {
      if (timelineEventId) {
        await api.updateTimelineEvent(memorial.id, timelineEventId, payload);
        setTimelineMessage(t("timelineUpdateSuccess"));
      } else {
        await api.createTimelineEvent(memorial.id, payload);
        setTimelineMessage(t("timelineCreateSuccess"));
      }
      resetTimelineForm();
      await mutateMemorial();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("timelineSaveError"));
    } finally {
      setSavingTimeline(false);
    }
  };

  const handleDeleteTimelineEvent = async (eventId: string) => {
    if (!memorial) return;
    setDeletingTimelineId(eventId);
    setTimelineMessage(null);
    setError(null);
    try {
      await api.deleteTimelineEvent(memorial.id, eventId);
      if (timelineEventId === eventId) {
        resetTimelineForm();
      }
      setTimelineMessage(t("timelineDeleteSuccess"));
      await mutateMemorial();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("timelineDeleteError"));
    } finally {
      setDeletingTimelineId(null);
    }
  };

  if (authLoading || isLoading) {
    return <div className="rounded-2xl border border-border bg-background p-6 text-sm text-muted">{tCommon("loading")}</div>;
  }

  if (!isAuthenticated) {
    return <div className="rounded-2xl border border-border bg-background p-6 text-sm text-muted">{t("signInRequired")}</div>;
  }

  if (!memorial) {
    return <div className="rounded-2xl border border-border bg-background p-6 text-sm text-muted">{t("notFound")}</div>;
  }

  const currentStatusLabel = t(`statuses.${memorial.status}`);
  const isSuperuser = user?.is_superuser ?? false;
  const canSubmitForApproval = isOwner && memorial.status === "DRAFT";
  const canFeature = isSuperuser && memorial.status === "PUBLISHED";
  const lastReviewedAt = memorial.last_reviewed_at ? new Date(memorial.last_reviewed_at).toLocaleString(locale) : null;
  const lastReviewDecisionLabel = memorial.last_review_decision ? t(`reviewDecisions.${memorial.last_review_decision}`) : null;
  const lastReviewerName = memorial.last_reviewed_by_name ?? t("unknownReviewer");
  const latestPendingGuestbookAt = pendingGuestbook[0]?.created_at ? new Date(pendingGuestbook[0].created_at).toLocaleString(locale) : null;
  const visibleReviewHistory = reviewHistory.slice(0, 5);
  const noticeMessage = searchParams.get("notice") === "submitted"
    ? t("submitSuccess")
    : searchParams.get("notice") === "draft-created"
      ? t("draftCreated")
      : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[2rem] border border-border bg-background p-6 shadow-soft sm:p-8">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">{t("name")}</span>
        <input required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("birthDate")}</span>
          <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("deathDate")}</span>
          <input type="date" value={deathDate} onChange={(event) => setDeathDate(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("burialSiteName")}</span>
          <input value={burialSiteName} onChange={(event) => setBurialSiteName(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("burialPlotName")}</span>
          <input value={burialPlotName} onChange={(event) => setBurialPlotName(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">{t("biography")}</span>
        <textarea rows={5} value={biography} onChange={(event) => setBiography(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">{t("epitaph")}</span>
        <input value={epitaph} onChange={(event) => setEpitaph(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">{t("announcement")}</span>
        <textarea rows={3} value={announcement} onChange={(event) => setAnnouncement(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
      </label>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t("familyTreeTitle")}</p>
            <p className="mt-1 text-xs text-muted">{t("familyTreeHint")}</p>
          </div>
          <button type="button" onClick={addFamilyMember} className="halvaa-btn-secondary cursor-pointer whitespace-nowrap">
            {t("familyTreeAdd")}
          </button>
        </div>
        {familyTree.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted">{t("familyTreeEmpty")}</p> : null}
        <div className="mt-4 space-y-3">
          {familyTree.map((member, index) => (
            <div key={`${member.name}-${index}`} className="grid gap-3 rounded-xl border border-border bg-background px-4 py-4 sm:grid-cols-[minmax(0,1fr)_180px_140px_auto]">
              <input value={member.name} onChange={(event) => updateFamilyMember(index, { name: event.target.value })} placeholder={t("familyTreeName")}
                className="rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
              <input value={member.relation} onChange={(event) => updateFamilyMember(index, { relation: event.target.value })} placeholder={t("familyTreeRelation")}
                className="rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
              <input value={member.years ?? ""} onChange={(event) => updateFamilyMember(index, { years: event.target.value })} placeholder={t("familyTreeYears")}
                className="rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
              <button type="button" onClick={() => removeFamilyMember(index)} className="inline-flex cursor-pointer items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary">
                {t("familyTreeRemove")}
              </button>
            </div>
          ))}
        </div>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">{t("qrCodeUrl")}</span>
        <input value={qrCodeUrl} onChange={(event) => setQrCodeUrl(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
      </label>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t("qrPreviewTitle")}</p>
            <p className="mt-1 text-xs text-muted">{t("qrGenerateHint")}</p>
          </div>
          <button type="button" onClick={handleGenerateQrCode} className="halvaa-btn-secondary cursor-pointer whitespace-nowrap">
            {t("generateQr")}
          </button>
        </div>

        {qrCodeUrl && (
          <div className="mt-4 flex justify-center rounded-2xl border border-dashed border-border bg-background p-4">
            <img src={qrCodeUrl} alt={t("qrPreviewTitle")} className="h-44 w-44 rounded-xl border border-border bg-white object-contain p-2" />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("latitude")}</span>
          <input type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("longitude")}</span>
          <input type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
        </label>
        <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="font-medium text-foreground">{t("status")}</p>
          <p className="mt-2 inline-flex rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted">{currentStatusLabel}</p>
          <p className="mt-2 text-xs text-muted">
            {memorial.status === "DRAFT"
              ? t("statusHints.DRAFT")
              : memorial.status === "PENDING_APPROVAL"
                ? t("statusHints.PENDING_APPROVAL")
                : memorial.status === "PUBLISHED"
                  ? t("statusHints.PUBLISHED")
                  : t("statusHints.FEATURED")}
          </p>
          {lastReviewedAt && lastReviewDecisionLabel ? <p className="mt-2 text-xs text-muted">{t("lastReviewed", { decision: lastReviewDecisionLabel, reviewedAt: lastReviewedAt, reviewer: lastReviewerName })}</p> : null}
        </div>
      </div>

      {isSuperuser ? (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-medium text-foreground">{t("reviewerTitle")}</p>
          <p className="mt-1 text-xs text-muted">{t("reviewerHint")}</p>
        </div>
      ) : null}

      {(visibleReviewHistory.length > 0 || pendingGuestbook.length > 0) ? (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-medium text-foreground">{t("reviewActivityTitle")}</p>
          <div className="mt-3 space-y-2 text-sm text-muted">
            {visibleReviewHistory.map((item, index) => {
              const createdAt = new Date(item.created_at).toLocaleString(locale);
              const reviewerName = item.reviewer_name ?? t("unknownReviewer");
              return (
                <p key={`${item.kind}-${item.created_at}-${index}`}>
                  {t("reviewActivityItem", {
                    detail: getReviewActivityLabel(item, t),
                    reviewer: reviewerName,
                    reviewedAt: createdAt,
                  })}
                </p>
              );
            })}
            {pendingGuestbook.length > 0 ? <p>{t("pendingGuestbookSummary", { count: pendingGuestbook.length, submittedAt: latestPendingGuestbookAt ?? t("unknownReviewDate") })}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-surface p-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("galleryUpload")}</span>
          <select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value)} className="mb-3 w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]">
            {MEDIA_CATEGORIES.map((category) => (
              <option key={category} value={category}>{t(`categories.${category}`)}</option>
            ))}
          </select>
          <input
            type="file"
            accept={uploadCategory === "DOCUMENT" || uploadCategory === "WILL" ? "image/*,application/pdf" : "image/*"}
            disabled={uploading}
            onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
            className="block w-full cursor-pointer rounded-xl border border-border bg-background px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white disabled:cursor-wait"
          />
        </label>
        <p className="mt-2 text-xs text-muted">{uploading ? t("uploading") : t("galleryUploadHint")}</p>
        {uploadMessage && <p className="mt-2 text-sm font-medium text-primary">{uploadMessage}</p>}

        {libraryMediaItems.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">{t("mediaLibraryTitle")}</p>
            {libraryMediaItems.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  {item.media_type === "IMAGE" && (
                    <img
                      src={item.thumbnail_url ?? item.original_url}
                      alt={getMediaLabel(item.original_url)}
                      className="h-14 w-14 rounded-lg border border-border object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{getMediaLabel(item.original_url)}</p>
                    <p className="text-xs text-muted">{t(`categories.${item.category}`)} - {item.mime_type}</p>
                    {item.title ? <p className="mt-1 text-xs font-medium text-foreground">{item.title}</p> : null}
                    {item.description ? <p className="mt-1 text-xs text-muted">{item.description}</p> : null}
                    {getMediaMeta(item).assetKind === "ARTIFACT" ? <p className="mt-1 text-xs font-medium text-primary">{t("artifactBadge")}</p> : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={item.original_url} target="_blank" rel="noreferrer" className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary">
                    {t("mediaOpen")}
                  </a>
                  <select
                    value={item.category}
                    onChange={(event) => void handleUpdateMediaCategory(item.id, event.target.value)}
                    disabled={updatingMediaId === item.id}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {MEDIA_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{t(`categories.${category}`)}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void handleEditMediaDetails(item.id)} disabled={updatingMediaId === item.id || removingMediaId === item.id} className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                    {t("mediaEditDetails")}
                  </button>
                  <button type="button" onClick={() => void handleToggleArtifact(item.id)} disabled={updatingMediaId === item.id || removingMediaId === item.id} className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                    {getMediaMeta(item).assetKind === "ARTIFACT" ? t("artifactUnset") : t("artifactSet")}
                  </button>
                  <button type="button" onClick={() => void handleRemoveMedia(item.id)} disabled={removingMediaId === item.id || updatingMediaId === item.id} className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                    {removingMediaId === item.id ? t("mediaRemoving") : t("mediaRemove")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("timelineMediaTitle")}</span>
          <p className="mb-3 text-xs text-muted">{t("timelineMediaHint")}</p>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(event) => void handleUpload(event.target.files?.[0] ?? null, TIMELINE_MEDIA_CATEGORY)}
            className="block w-full cursor-pointer rounded-xl border border-border bg-background px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white disabled:cursor-wait"
          />
        </label>

        {timelineMediaItems.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted">{t("timelineMediaEmpty")}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {timelineMediaItems.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  {item.media_type === "IMAGE" && (
                    <img
                      src={item.thumbnail_url ?? item.original_url}
                      alt={getMediaLabel(item.original_url)}
                      className="h-14 w-14 rounded-lg border border-border object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{getMediaLabel(item.original_url)}</p>
                    <p className="text-xs text-muted">{t("categories.TIMELINE")} - {item.mime_type}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={item.original_url} target="_blank" rel="noreferrer" className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary">
                    {t("mediaOpen")}
                  </a>
                  <select
                    value={item.category}
                    onChange={(event) => void handleUpdateMediaCategory(item.id, event.target.value)}
                    disabled={updatingMediaId === item.id}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {[...MEDIA_CATEGORIES, TIMELINE_MEDIA_CATEGORY].map((category) => (
                      <option key={category} value={category}>{t(`categories.${category}`)}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void handleRemoveMedia(item.id)} disabled={removingMediaId === item.id || updatingMediaId === item.id} className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                    {removingMediaId === item.id ? t("mediaRemoving") : t("mediaRemove")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t("timelineEventsTitle")}</p>
          <p className="mt-1 text-xs text-muted">{t("timelineEventsHint")}</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground">{t("timelineTitleField")}</span>
            <input value={timelineTitle} onChange={(event) => setTimelineTitle(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground">{t("timelineTypeField")}</span>
            <select value={timelineType} onChange={(event) => setTimelineType(event.target.value as TimelineEventType)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]">
              <option value="BIOGRAPHY">{tTimeline("types.BIOGRAPHY")}</option>
              <option value="LIFE_EVENT">{tTimeline("types.LIFE_EVENT")}</option>
              <option value="LOCATION">{tTimeline("types.LOCATION")}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground">{t("timelineDateField")}</span>
            <input type="date" value={timelineDate} onChange={(event) => setTimelineDate(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground">{t("timelineSortOrderField")}</span>
            <input type="number" value={timelineSortOrder} onChange={(event) => setTimelineSortOrder(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
          </label>
        </div>

        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("timelineBodyField")}</span>
          <textarea rows={3} value={timelineBody} onChange={(event) => setTimelineBody(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground">{t("timelineLocationField")}</span>
            <input value={timelineLocation} onChange={(event) => setTimelineLocation(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-foreground">{t("timelineMediaField")}</span>
            <select value={timelineMediaId} onChange={(event) => setTimelineMediaId(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]">
              <option value="">{t("timelineMediaNone")}</option>
              {timelineMediaItems.map((item) => (
                <option key={item.id} value={item.id}>{getMediaLabel(item.original_url)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void handleSaveTimelineEvent()} disabled={savingTimeline} className="halvaa-btn-secondary cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60">
            {savingTimeline ? t("timelineSaving") : timelineEventId ? t("timelineUpdate") : t("timelineCreate")}
          </button>
          {timelineEventId && (
            <button type="button" onClick={resetTimelineForm} className="inline-flex cursor-pointer items-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary">
              {tCommon("cancel")}
            </button>
          )}
        </div>

        {timelineMessage && <p className="mt-3 text-sm font-medium text-primary">{timelineMessage}</p>}

        {memorial.timeline_events.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted">{t("timelineEventsEmpty")}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {memorial.timeline_events.map((event) => {
              const translation = event.translations?.[locale] ?? event.translations?.en ?? {};
              return (
                <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    {event.thumbnail_url && <img src={event.thumbnail_url} alt={translation.title ?? translation.name ?? event.id} className="h-14 w-14 rounded-lg border border-border object-cover" />}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{translation.title ?? translation.name ?? t("timelineUntitled")}</p>
                      <p className="text-xs text-muted">{tTimeline(`types.${event.event_type}`)}{event.event_date ? ` - ${event.event_date}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => handleEditTimelineEvent(event)} className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary">
                      {t("timelineEdit")}
                    </button>
                    <button type="button" onClick={() => void handleDeleteTimelineEvent(event.id)} disabled={deletingTimelineId === event.id} className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                      {deletingTimelineId === event.id ? t("timelineDeleting") : t("timelineDelete")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t("collaboratorsTitle")}</p>
          <p className="mt-1 text-xs text-muted">{t("collaboratorsHint")}</p>
        </div>

        <div className="mt-4 space-y-3">
          {(collaborators?.items ?? []).map((collaborator) => (
            <div key={collaborator.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{collaborator.full_name}</p>
                <p className="text-xs text-muted">{collaborator.email}</p>
                {collaborator.accepted_at === null && <p className="mt-1 text-xs font-medium text-primary">{t("collaboratorPending")}</p>}
              </div>
              <div className="flex items-center gap-2">
                {isOwner && collaborator.role !== "OWNER" ? (
                  <select
                    value={collaborator.role}
                    onChange={(event) => void handleUpdateCollaboratorRole(collaborator.id, event.target.value as MemorialCollaborator["role"])}
                    disabled={updatingCollaboratorId === collaborator.id || removingCollaboratorId === collaborator.id}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="EDITOR">{t("roles.EDITOR")}</option>
                    <option value="VIEWER">{t("roles.VIEWER")}</option>
                  </select>
                ) : (
                  <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted">{t(`roles.${collaborator.role}`)}</span>
                )}
                {isOwner && collaborator.role !== "OWNER" && (
                  <button type="button" onClick={() => void handleResendCollaboratorInvitation(collaborator.id)} disabled={collaborator.accepted_at !== null || resendingCollaboratorId === collaborator.id} className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                    {resendingCollaboratorId === collaborator.id ? t("collaboratorResending") : t("collaboratorResend")}
                  </button>
                )}
                {isOwner && collaborator.role !== "OWNER" && (
                  <button type="button" onClick={() => void handleRemoveCollaborator(collaborator.id)} disabled={removingCollaboratorId === collaborator.id} className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                    {removingCollaboratorId === collaborator.id ? t("collaboratorRemoving") : t("collaboratorRemove")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px_auto]">
          <input
            type="email"
            value={collaboratorEmail}
            onChange={(event) => setCollaboratorEmail(event.target.value)}
            placeholder={t("collaboratorEmail")}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]"
          />
          <select
            value={collaboratorRole}
            onChange={(event) => setCollaboratorRole(event.target.value as MemorialCollaborator["role"])}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]"
          >
            <option value="EDITOR">{t("roles.EDITOR")}</option>
            <option value="VIEWER">{t("roles.VIEWER")}</option>
          </select>
          {isOwner ? (
            <button type="button" onClick={() => void handleInviteCollaborator()} disabled={inviting} className="halvaa-btn-secondary cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60">
              {inviting ? t("collaboratorInviting") : t("collaboratorInvite")}
            </button>
          ) : (
            <div className="flex items-center text-xs text-muted">{t("collaboratorOwnerOnly")}</div>
          )}
        </div>

        {inviteMessage && <p className="mt-3 text-sm font-medium text-primary">{inviteMessage}</p>}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t("guestbookModerationTitle")}</p>
          <p className="mt-1 text-xs text-muted">{t("guestbookModerationHint")}</p>
        </div>

        {pendingGuestbook.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted">{t("guestbookModerationEmpty")}</p>
        ) : (
          <div className="mt-4 space-y-3">
            {pendingGuestbook.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border bg-background px-4 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{entry.author_name}</p>
                  <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted">{t("guestbookPendingBadge")}</span>
                </div>
                <p className="mt-3 leading-7 text-foreground/80">{entry.message}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void handleModerateGuestbook(entry.id, "APPROVED")} disabled={moderatingEntryId === entry.id} className="halvaa-btn-secondary cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60">
                    {moderatingEntryId === entry.id ? t("guestbookModerating") : t("guestbookApprove")}
                  </button>
                  <button type="button" onClick={() => void handleModerateGuestbook(entry.id, "REJECTED")} disabled={moderatingEntryId === entry.id} className="inline-flex cursor-pointer items-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                    {t("guestbookReject")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(saveMessage ?? noticeMessage) && <p className="text-sm text-primary">{saveMessage ?? noticeMessage}</p>}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={saving} className="halvaa-btn-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? t("saving") : t("save")}
        </button>
        {canSubmitForApproval ? (
          <button type="button" onClick={() => void handleWorkflowAction("submit")} disabled={saving} className="halvaa-btn-secondary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? t("saving") : t("submitForApproval")}
          </button>
        ) : null}
        {canFeature ? (
          <button type="button" onClick={() => void handleWorkflowAction("feature")} disabled={saving} className="halvaa-btn-secondary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? t("saving") : t("featureNow")}
          </button>
        ) : null}
        <Link href={`/memorial/${memorial.slug}`} className="halvaa-btn-secondary inline-flex cursor-pointer">
          {tCommon("cancel")}
        </Link>
      </div>
    </form>
  );
}
