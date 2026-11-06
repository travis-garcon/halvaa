"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useLocale, useTranslations } from "next-intl";

import { useAuth } from "@/hooks/use-auth";
import { Link, useRouter } from "@/i18n/routing";
import { api, ApiError } from "@/lib/api-client";
import { invalidateExploreAfterMemorialDelete } from "@/lib/explore-cache";
import { joinList, splitList } from "@/lib/memorial-form";
import { MapboxLocationPicker, type PickedLocation } from "@/components/ui/MapboxLocationPicker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FieldLabel } from "@/components/ui/InfoTip";
import { LocalizedDateInput } from "@/components/ui/LocalizedDateInput";
import { MediaPreviewDialog, preparePreviewFiles, type PreviewFile } from "@/components/ui/MediaPreviewDialog";
import { notifyApp } from "@/components/ui/AppNotifications";
import type { FamilyMember, MemorialCollaborator, MemorialLocation, MemorialReviewActivityItem, TimelineEventPublic, TimelineEventType } from "@/types/memorial";

type EditMemorialFormProps = {
  slug: string;
};

const TIMELINE_MEDIA_CATEGORY = "TIMELINE" as const;
const EDIT_STEPS = ["details", "media", "manage"] as const;

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
    headerRole: meta.header_role,
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
  const router = useRouter();
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
  const [editLocale, setEditLocale] = useState(locale);
  const [biography, setBiography] = useState("");
  const [epitaph, setEpitaph] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [burialAddress, setBurialAddress] = useState("");
  const [burialSiteName, setBurialSiteName] = useState("");
  const [burialPlotName, setBurialPlotName] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [category, setCategory] = useState("");
  const [gender, setGender] = useState("");
  const [occupation, setOccupation] = useState("");
  const [nationality, setNationality] = useState("");
  const [religion, setReligion] = useState("");
  const [languages, setLanguages] = useState("");
  const [countries, setCountries] = useState("");
  const [cities, setCities] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [deathPlace, setDeathPlace] = useState("");
  const [placesLived, setPlacesLived] = useState("");
  const [tags, setTags] = useState("");
  const [locations, setLocations] = useState<MemorialLocation[]>([]);
  const [pickerTarget, setPickerTarget] = useState<"primary" | number | null>(null);
  const [familyTree, setFamilyTree] = useState<FamilyMember[]>([]);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [saving, setSaving] = useState(false);
  const [editStep, setEditStep] = useState(0);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loadedMemorialId, setLoadedMemorialId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory] = useState("GALLERY");
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const [previewCategory, setPreviewCategory] = useState("GALLERY");
  const [previewHeaderRole, setPreviewHeaderRole] = useState<"portrait" | "banner" | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [mediaDrafts, setMediaDrafts] = useState<Record<string, { title: string; description: string; category: string }>>({});
  const [updatingHeaderRoleId, setUpdatingHeaderRoleId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<"library" | "timeline" | null>(null);
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
  const [translating, setTranslating] = useState(false);
  const [visibilityDialogOpen, setVisibilityDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingMemorial, setDeletingMemorial] = useState(false);
  const autosaveReadyRef = useRef(false);
  const availableTranslationLocales = memorial
    ? Array.from(new Set([locale, editLocale, "en", "fa", "ar", "zh", ...Object.keys(memorial.translations ?? {})]))
    : [locale];

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
    const translation = memorial.translations?.[editLocale] ?? memorial.translations?.en ?? {};
    setName(translation.name ?? "");
    setBiography(translation.biography ?? "");
    setEpitaph(translation.epitaph ?? "");
    setAnnouncement(translation.announcement ?? "");
    setBirthDate(memorial.birth_date ?? "");
    setDeathDate(memorial.death_date ?? "");
    setBurialAddress(memorial.burial_address ?? "");
    setBurialSiteName(memorial.burial_site_name ?? "");
    setBurialPlotName(memorial.burial_plot_name ?? "");
    setQrCodeUrl(memorial.qr_code_url ?? "");
    setCategory(memorial.category ?? "");
    setGender(typeof memorial.filter_tags?.gender === "string" ? memorial.filter_tags.gender : "");
    setCountries(joinList(memorial.filter_tags?.countries));
    setCities(joinList(memorial.filter_tags?.cities));
    setTags(joinList(memorial.filter_tags?.tags));
    setBirthPlace(typeof memorial.metadata?.birth_place === "string" ? memorial.metadata.birth_place : "");
    setDeathPlace(typeof memorial.metadata?.death_place === "string" ? memorial.metadata.death_place : "");
    setOccupation(typeof memorial.metadata?.occupation === "string" ? memorial.metadata.occupation : "");
    setNationality(typeof memorial.metadata?.nationality === "string" ? memorial.metadata.nationality : "");
    setReligion(typeof memorial.metadata?.religion === "string" ? memorial.metadata.religion : "");
    setLanguages(joinList(memorial.metadata?.languages));
    setPlacesLived(joinList(memorial.metadata?.places_lived));
    setLocations(memorial.locations && memorial.locations.length > 0 ? memorial.locations : [{ kind: "burial", label: t("burialSiteName") }]);
    setFamilyTree((memorial.family_tree ?? []).map((member) => ({ ...member, id: member.id ?? crypto.randomUUID() })));
    setLatitude(memorial.latitude?.toString() ?? "");
    setLongitude(memorial.longitude?.toString() ?? "");
    setLoadedMemorialId(memorial.id);
    autosaveReadyRef.current = true;
  }, [editLocale, memorial, t]);

  useEffect(() => {
    setMediaDrafts((current) => {
      const next = { ...current };
      mediaItems.forEach((item) => {
        next[item.id] = next[item.id] ?? {
          title: item.title ?? "",
          description: item.description ?? "",
          category: item.category,
        };
      });
      return next;
    });
  }, [mediaItems]);

  const buildMemorialPayload = () => {
    if (!memorial) {
      return null;
    }

    return {
      birth_date: birthDate || null,
      death_date: deathDate || null,
      burial_address: burialAddress.trim() || null,
      burial_site_name: burialSiteName.trim() || null,
      burial_plot_name: burialPlotName.trim() || null,
      qr_code_url: qrCodeUrl.trim() || null,
      category: category.trim() || null,
      metadata: {
        birth_place: birthPlace.trim() || null,
        death_place: deathPlace.trim() || null,
        occupation: occupation.trim() || null,
        nationality: nationality.trim() || null,
        religion: religion.trim() || null,
        languages: splitList(languages),
        places_lived: splitList(placesLived),
      },
      filter_tags: {
        gender: gender.trim() || null,
        countries: splitList(countries),
        cities: splitList(cities),
        tags: splitList(tags),
      },
      locations: locations.filter((location) => location.kind || location.label || location.address || location.latitude || location.longitude),
      family_tree: familyTree.filter((member) => member.name.trim() && member.relation.trim()),
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      translations: {
        ...memorial.translations,
        [editLocale]: {
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

  useEffect(() => {
    if (!memorial || loadedMemorialId !== memorial.id || !autosaveReadyRef.current || saving) return;
    const timer = window.setTimeout(() => {
      const payload = buildMemorialPayload();
      if (!payload) return;
      setAutosaveState("saving");
      void api.updateMemorial(memorial.id, payload)
        .then(() => setAutosaveState("saved"))
        .catch(() => setAutosaveState("error"));
    }, 1400);
    return () => window.clearTimeout(timer);
    // The payload builder reads exactly the state values listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    announcement,
    biography,
    birthDate,
    birthPlace,
    burialAddress,
    burialPlotName,
    burialSiteName,
    category,
    cities,
    countries,
    deathDate,
    deathPlace,
    editLocale,
    epitaph,
    familyTree,
    gender,
    languages,
    latitude,
    loadedMemorialId,
    locations,
    longitude,
    memorial,
    name,
    nationality,
    occupation,
    placesLived,
    qrCodeUrl,
    religion,
    saving,
    tags,
  ]);

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
      notifyApp({ message: t("saveSuccess"), tone: "success" });
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

  const handleVisibilityToggle = async () => {
    if (!memorial) return;
    const nextStatus = memorial.status === "DEACTIVATED" ? "DRAFT" : "DEACTIVATED";

    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      await persistMemorialDetails();
      await api.updateMemorialStatus(memorial.id, nextStatus);
      await mutateMemorial();
      setSaveMessage(memorial.status === "DEACTIVATED" ? t("reactivateSuccess") : t("deactivateSuccess"));
      setVisibilityDialogOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("visibilityError"));
    } finally {
      setSaving(false);
    }
  };

  const updateFamilyMember = (index: number, next: Partial<FamilyMember>) => {
    setFamilyTree((current) => current.map((member, currentIndex) => (currentIndex === index ? { ...member, ...next } : member)));
  };

  const addFamilyMember = () => {
    setFamilyTree((current) => [...current, { id: crypto.randomUUID(), name: "", relation: "", years: "" }]);
  };

  const removeFamilyMember = (index: number) => {
    setFamilyTree((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateLocation = (index: number, next: Partial<MemorialLocation>) => {
    setLocations((current) => current.map((location, currentIndex) => (currentIndex === index ? { ...location, ...next } : location)));
  };

  const addLocation = () => {
    setLocations((current) => [...current, { kind: "custom", label: "" }]);
  };

  const removeLocation = (index: number) => {
    setLocations((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const selectedPickerValue =
    pickerTarget === "primary"
      ? latitude && longitude
        ? { latitude: Number(latitude), longitude: Number(longitude) }
        : null
      : typeof pickerTarget === "number" && locations[pickerTarget]?.latitude && locations[pickerTarget]?.longitude
        ? { latitude: Number(locations[pickerTarget].latitude), longitude: Number(locations[pickerTarget].longitude) }
        : null;

  const handleLocationPick = (location: PickedLocation) => {
    if (pickerTarget === "primary") {
      setLatitude(String(location.latitude));
      setLongitude(String(location.longitude));
    } else if (typeof pickerTarget === "number") {
      updateLocation(pickerTarget, location);
    }
  };

  const queueUploadFiles = (
    files: FileList | File[] | null,
    category = uploadCategory,
    headerRole: "portrait" | "banner" | null = null,
  ) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files);
    setPreviewCategory(headerRole === "portrait" ? "AVATAR" : category);
    setPreviewHeaderRole(headerRole);
    setPreviewFiles(
      preparePreviewFiles(
        headerRole ? selected.slice(0, 1) : selected,
        t("uploadInvalidType"),
        (size) => t("uploadTooLarge", { size }),
      ),
    );
  };

  const closeUploadPreview = () => {
    previewFiles.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setPreviewFiles([]);
    setUploadProgress({});
  };

  const removePreviewFile = (id: string) => {
    setPreviewFiles((current) => {
      const selected = current.find((item) => item.id === id);
      if (selected?.previewUrl) URL.revokeObjectURL(selected.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const handleUploadFiles = async () => {
    if (previewFiles.length === 0 || !memorial) return;
    setUploading(true);
    setUploadMessage(null);
    setError(null);
    try {
      for (const item of previewFiles) {
        const uploaded = await api.uploadMedia(memorial.id, item.file, previewCategory, (progress) => {
          setUploadProgress((current) => ({ ...current, [item.id]: progress }));
        });
        if (previewHeaderRole) {
          await api.updateMedia(memorial.id, uploaded.id, {
            translations: { meta: { header_role: previewHeaderRole } },
          });
        }
      }
      setUploadMessage(t("uploadSuccess"));
      await mutateMedia();
      closeUploadPreview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("uploadError"));
    } finally {
      setUploading(false);
      setDragTarget(null);
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>, category: string, headerRole: "portrait" | "banner" | null = null) => {
    event.preventDefault();
    setDragTarget(null);
    queueUploadFiles(Array.from(event.dataTransfer.files), category, headerRole);
  };

  const handleDeleteMemorial = async () => {
    if (!memorial) return;
    setDeletingMemorial(true);
    setError(null);
    try {
      await api.deleteMemorial(memorial.id);
      await invalidateExploreAfterMemorialDelete(memorial.id);
      notifyApp({ message: t("deleteSuccess"), tone: "success" });
      router.push("/profile");
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : t("deleteError"));
    } finally {
      setDeletingMemorial(false);
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

  const handleEditMediaDetails = async (mediaId: string) => {
    if (!memorial) return;
    const draft = mediaDrafts[mediaId];
    if (!draft) return;

    setUpdatingMediaId(mediaId);
    setError(null);
    try {
      await api.updateMedia(memorial.id, mediaId, {
        category: draft.category,
        title: draft.title.trim() || null,
        description: draft.description.trim() || null,
      });
      setUploadMessage(t("mediaDetailsSuccess"));
      await mutateMedia();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("mediaDetailsError"));
    } finally {
      setUpdatingMediaId(null);
    }
  };

  const handleSetHeaderRole = async (mediaId: string, role: "portrait" | "banner") => {
    if (!memorial) return;
    setUpdatingHeaderRoleId(mediaId);
    setError(null);
    try {
      const targets = libraryMediaItems.filter((item) => item.media_type === "IMAGE" && (item.id === mediaId || getMediaMeta(item).headerRole === role));
      await Promise.all(
        targets.map((item) =>
          api.updateMedia(memorial.id, item.id, {
            translations: {
              ...item.translations,
              meta: {
                ...(item.translations.meta ?? {}),
                ...(item.id === mediaId ? { header_role: role } : { header_role: "" }),
              },
            },
          }),
        ),
      );
      setUploadMessage(role === "portrait" ? t("portraitSaved") : t("bannerSaved"));
      await mutateMedia();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("mediaDetailsError"));
    } finally {
      setUpdatingHeaderRoleId(null);
    }
  };

  const handleTranslateMemorial = async () => {
    if (!memorial) return;
    setTranslating(true);
    setError(null);
    try {
      await persistMemorialDetails();
      await api.translateMemorial(memorial.id, {
        source_locale: editLocale,
        target_locales: ["en", "fa", "ar", "zh"],
      });
      await mutateMemorial();
      setSaveMessage(t("translationStarted"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("translationError"));
    } finally {
      setTranslating(false);
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
  const dateLabels = {
    persian: t("calendar.persian"),
    gregorian: t("calendar.gregorian"),
    year: t("calendar.year"),
    month: t("calendar.month"),
    day: t("calendar.day"),
    converted: t("calendar.converted"),
    empty: t("calendar.empty"),
  };
  const autosaveLabel = autosaveState === "saving"
    ? t("autosave.saving")
    : autosaveState === "saved"
      ? t("autosave.saved")
      : autosaveState === "error"
        ? t("autosave.error")
        : t("autosave.waiting");
  const selectedPortrait = libraryMediaItems.find((item) => getMediaMeta(item).headerRole === "portrait");
  const selectedBanner = libraryMediaItems.find((item) => getMediaMeta(item).headerRole === "banner");

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border bg-background p-4 shadow-soft sm:p-7">
      <div className="border-b border-border pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">{t("wizardTitle")}</p>
          <p className="text-xs text-muted">{autosaveLabel}</p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {EDIT_STEPS.map((stepKey, index) => (
            <button key={stepKey} type="button" onClick={() => setEditStep(index)} className={["memorial-step-tab", editStep === index ? "is-active" : ""].join(" ")}>
              <span>{index + 1}</span>
              <strong>{t(`steps.${stepKey}`)}</strong>
            </button>
          ))}
        </div>
      </div>

      {editStep === 0 ? (
        <>
      <label className="block text-sm">
        <FieldLabel label={t("name")} help={t("help.name")} />
        <input required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
      </label>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t("translationEditorTitle")}</p>
            <p className="mt-1 text-xs text-muted">{t("translationEditorHint")}</p>
          </div>
          <select value={editLocale} onChange={(event) => setEditLocale(event.target.value)} className="rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground">
            {availableTranslationLocales.map((itemLocale) => (
              <option key={itemLocale} value={itemLocale}>{itemLocale.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <p className="mt-3 text-xs text-muted">{t("translationStatusHint")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <FieldLabel label={t("birthDate")} help={t("help.birthDate")} />
          <LocalizedDateInput locale={locale} value={birthDate} onChange={setBirthDate} labels={dateLabels} />
        </label>
        <label className="block text-sm">
          <FieldLabel label={t("deathDate")} help={t("help.deathDate")} />
          <LocalizedDateInput locale={locale} value={deathDate} onChange={setDeathDate} labels={dateLabels} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("burialAddress")}</span>
          <input value={burialAddress} onChange={(event) => setBurialAddress(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
        </label>
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
        <FieldLabel label={t("biography")} help={t("help.biography")} />
        <textarea rows={5} value={biography} onChange={(event) => setBiography(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
      </label>

      <label className="block text-sm">
        <FieldLabel label={t("epitaph")} help={t("help.epitaph")} />
        <input value={epitaph} onChange={(event) => setEpitaph(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-foreground">{t("announcement")}</span>
        <textarea rows={3} value={announcement} onChange={(event) => setAnnouncement(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
      </label>

      <details className="rounded-lg border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">{t("optionalDetails")}</summary>
      <div className="mt-4">
        <p className="text-sm font-medium text-foreground">{t("metadataTitle")}</p>
        <p className="mt-1 text-xs text-muted">{t("metadataHint")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["category", category, setCategory],
            ["gender", gender, setGender],
            ["occupation", occupation, setOccupation],
            ["nationality", nationality, setNationality],
            ["religion", religion, setReligion],
            ["birthPlace", birthPlace, setBirthPlace],
            ["deathPlace", deathPlace, setDeathPlace],
            ["languages", languages, setLanguages],
            ["countries", countries, setCountries],
            ["cities", cities, setCities],
            ["placesLived", placesLived, setPlacesLived],
            ["tags", tags, setTags],
          ].map(([key, value, setter]) => (
            <label key={key as string} className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t(key as string)}</span>
              <input value={value as string} onChange={(event) => (setter as (next: string) => void)(event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
            </label>
          ))}
        </div>
      </div>
      </details>

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
            <div key={member.id ?? `family-${index}`} className="grid gap-3 rounded-xl border border-border bg-background px-4 py-4 sm:grid-cols-[minmax(0,1fr)_180px_140px_auto]">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={() => setPickerTarget("primary")} className="halvaa-btn-secondary cursor-pointer self-end">
          {t("pickLocation")}
        </button>
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
                  : memorial.status === "FEATURED"
                    ? t("statusHints.FEATURED")
                    : t("statusHints.DEACTIVATED")}
          </p>
          {lastReviewedAt && lastReviewDecisionLabel ? <p className="mt-2 text-xs text-muted">{t("lastReviewed", { decision: lastReviewDecisionLabel, reviewedAt: lastReviewedAt, reviewer: lastReviewerName })}</p> : null}
          {isOwner ? (
            <button type="button" onClick={() => setVisibilityDialogOpen(true)} disabled={saving} className="mt-3 inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
              {memorial.status === "DEACTIVATED" ? t("reactivateMemorial") : t("deactivateMemorial")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t("locationsTitle")}</p>
            <p className="mt-1 text-xs text-muted">{t("locationsHint")}</p>
          </div>
          <button type="button" onClick={addLocation} className="halvaa-btn-secondary cursor-pointer whitespace-nowrap">
            {t("addLocation")}
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {locations.map((location, index) => (
            <div key={`${location.kind}-${index}`} className="grid gap-3 rounded-xl border border-border bg-background px-4 py-4 sm:grid-cols-3">
              <input value={location.kind} onChange={(event) => updateLocation(index, { kind: event.target.value })} placeholder={t("locationKind")} className="rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
              <input value={location.label ?? ""} onChange={(event) => updateLocation(index, { label: event.target.value })} placeholder={t("locationLabel")} className="rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
              <input value={location.address ?? ""} onChange={(event) => updateLocation(index, { address: event.target.value })} placeholder={t("locationAddress")} className="rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
              <input value={location.city ?? ""} onChange={(event) => updateLocation(index, { city: event.target.value })} placeholder={t("city")} className="rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
              <input value={location.country ?? ""} onChange={(event) => updateLocation(index, { country: event.target.value })} placeholder={t("country")} className="rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPickerTarget(index)} className="halvaa-btn-secondary cursor-pointer px-3 py-2 text-xs">{t("pickLocation")}</button>
                <button type="button" onClick={() => removeLocation(index)} className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary">{t("familyTreeRemove")}</button>
              </div>
              {(location.latitude || location.longitude) ? <p className="text-xs text-muted sm:col-span-3">{location.latitude ?? "-"}, {location.longitude ?? "-"}</p> : null}
            </div>
          ))}
        </div>
      </div>
        </>
      ) : null}

      {editStep === 2 ? (
        <>
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
        </>
      ) : null}

      {editStep === 1 ? (
        <>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{t("headerImagesTitle")}</p>
            <p className="text-xs text-muted">{t("headerImagesHint")}</p>
          </div>
          <button type="button" onClick={() => void handleTranslateMemorial()} disabled={translating || saving} className="halvaa-btn-secondary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
            {translating ? t("translating") : t("translateNow")}
          </button>
        </div>
        <div className="memorial-header-preview mb-4">
          <div className="memorial-header-preview-banner">
            {selectedBanner ? <img src={selectedBanner.thumbnail_url ?? selectedBanner.original_url} alt={t("bannerBadge")} /> : <span>{t("bannerPreviewEmpty")}</span>}
          </div>
          <div className="memorial-header-preview-portrait">
            {selectedPortrait ? <img src={selectedPortrait.thumbnail_url ?? selectedPortrait.original_url} alt={t("portraitBadge")} /> : <span>?</span>}
          </div>
          <p>{name}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["banner", "portrait"] as const).map((role) => (
            <label
              key={role}
              onDragOver={(event) => {
                event.preventDefault();
                setDragTarget("library");
              }}
              onDragLeave={() => setDragTarget(null)}
              onDrop={(event) => handleDrop(event, "GALLERY", role)}
              className={["media-drop-zone", dragTarget === "library" ? "is-active" : ""].join(" ")}
            >
              <FieldLabel label={role === "banner" ? t("bannerImage") : t("portraitImage")} help={t(`help.${role}`)} />
              <span>{t("choosePhoto")}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(event: ChangeEvent<HTMLInputElement>) => queueUploadFiles(event.target.files, "GALLERY", role)}
                className="sr-only"
              />
            </label>
          ))}
        </div>
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragTarget("library");
          }}
          onDragLeave={() => setDragTarget(null)}
          onDrop={(event) => handleDrop(event, "GALLERY")}
          className={["media-drop-zone mt-3", dragTarget === "library" ? "is-active" : ""].join(" ")}
        >
          <FieldLabel label={t("galleryUpload")} help={t("help.gallery")} />
          <span>{t("chooseMedia")}</span>
          <small>{uploading ? t("uploading") : t("galleryUploadHint")}</small>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            multiple
            disabled={uploading}
            onChange={(event: ChangeEvent<HTMLInputElement>) => queueUploadFiles(event.target.files, "GALLERY")}
            className="sr-only"
          />
        </label>
        {uploadMessage && <p className="mt-2 text-sm font-medium text-primary">{uploadMessage}</p>}

        {libraryMediaItems.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">{t("mediaLibraryTitle")}</p>
            {libraryMediaItems.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
                <div className="flex min-w-0 items-center gap-3">
                  {item.media_type === "IMAGE" && (
                    <img
                      src={item.thumbnail_url ?? item.original_url}
                      alt={getMediaLabel(item.original_url)}
                      className="h-14 w-14 rounded-lg border border-border object-cover"
                    />
                  )}
                  {item.media_type === "VIDEO" ? (
                    <video src={item.original_url} controls playsInline preload="metadata" className="h-14 w-20 rounded-lg border border-border object-cover" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{getMediaLabel(item.original_url)}</p>
                    <p className="text-xs text-muted">{t(`categories.${item.category}`)} - {item.mime_type}</p>
                    {item.file_size_bytes ? <p className="mt-1 text-xs text-muted">{Math.round(item.file_size_bytes / 1024)} KB - {item.processing_status}</p> : null}
                    {item.title ? <p className="mt-1 text-xs font-medium text-foreground">{item.title}</p> : null}
                    {item.description ? <p className="mt-1 text-xs text-muted">{item.description}</p> : null}
                    {getMediaMeta(item).assetKind === "ARTIFACT" ? <p className="mt-1 text-xs font-medium text-primary">{t("artifactBadge")}</p> : null}
                    {getMediaMeta(item).headerRole === "portrait" ? <p className="mt-1 text-xs font-medium text-primary">{t("portraitBadge")}</p> : null}
                    {getMediaMeta(item).headerRole === "banner" ? <p className="mt-1 text-xs font-medium text-primary">{t("bannerBadge")}</p> : null}
                  </div>
                </div>
                <div className="grid gap-2">
                  <input
                    value={mediaDrafts[item.id]?.title ?? ""}
                    onChange={(event) => setMediaDrafts((current) => ({ ...current, [item.id]: { title: event.target.value, description: current[item.id]?.description ?? "", category: current[item.id]?.category ?? item.category } }))}
                    placeholder={t("mediaTitlePrompt")}
                    className="rounded-xl border border-border px-3 py-2 text-xs outline-none transition focus:border-primary"
                  />
                  <input
                    value={mediaDrafts[item.id]?.description ?? ""}
                    onChange={(event) => setMediaDrafts((current) => ({ ...current, [item.id]: { title: current[item.id]?.title ?? "", description: event.target.value, category: current[item.id]?.category ?? item.category } }))}
                    placeholder={t("mediaDescriptionPrompt")}
                    className="rounded-xl border border-border px-3 py-2 text-xs outline-none transition focus:border-primary"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                  <a href={item.original_url} target="_blank" rel="noreferrer" className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary">
                    {t("mediaOpen")}
                  </a>
                  <button type="button" onClick={() => void handleEditMediaDetails(item.id)} disabled={updatingMediaId === item.id || removingMediaId === item.id} className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                    {updatingMediaId === item.id ? t("saving") : t("mediaEditDetails")}
                  </button>
                  <button type="button" onClick={() => void handleToggleArtifact(item.id)} disabled={updatingMediaId === item.id || removingMediaId === item.id} className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                    {getMediaMeta(item).assetKind === "ARTIFACT" ? t("artifactUnset") : t("artifactSet")}
                  </button>
                  {item.media_type === "IMAGE" ? (
                    <>
                      <button type="button" onClick={() => void handleSetHeaderRole(item.id, "portrait")} disabled={updatingHeaderRoleId === item.id} className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                        {t("setAsPortrait")}
                      </button>
                      <button type="button" onClick={() => void handleSetHeaderRole(item.id, "banner")} disabled={updatingHeaderRoleId === item.id} className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                        {t("setAsBanner")}
                      </button>
                    </>
                  ) : null}
                  <button type="button" onClick={() => void handleRemoveMedia(item.id)} disabled={removingMediaId === item.id || updatingMediaId === item.id} className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                    {removingMediaId === item.id ? t("mediaRemoving") : t("mediaRemove")}
                  </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      ) : null}

      {editStep === 2 ? (
        <>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("timelineMediaTitle")}</span>
          <p className="mb-3 text-xs text-muted">{t("timelineMediaHint")}</p>
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragTarget("timeline");
            }}
            onDragLeave={() => setDragTarget(null)}
            onDrop={(event) => handleDrop(event, TIMELINE_MEDIA_CATEGORY)}
            className={["block cursor-pointer rounded-2xl border border-dashed px-4 py-6 text-center transition", dragTarget === "timeline" ? "border-primary bg-primary/5" : "border-border bg-background"].join(" ")}
          >
            <span className="block text-sm font-semibold text-foreground">{t("dropFiles")}</span>
            <span className="mt-1 block text-xs text-muted">{uploading ? t("uploading") : t("timelineMediaHint")}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4"
              multiple
              disabled={uploading}
              onChange={(event: ChangeEvent<HTMLInputElement>) => queueUploadFiles(event.target.files, TIMELINE_MEDIA_CATEGORY)}
              className="sr-only"
            />
          </label>
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
                  {item.media_type === "VIDEO" ? (
                    <video src={item.original_url} controls playsInline preload="metadata" className="h-14 w-20 rounded-lg border border-border object-cover" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{getMediaLabel(item.original_url)}</p>
                    <p className="text-xs text-muted">{t("categories.TIMELINE")} - {item.mime_type}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={item.original_url} target="_blank" rel="noreferrer" className="inline-flex cursor-pointer items-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary">
                    {t("mediaOpen")}
                  </a>
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
            <FieldLabel label={t("timelineDateField")} help={t("help.timelineDate")} />
            <LocalizedDateInput locale={locale} value={timelineDate} onChange={setTimelineDate} labels={dateLabels} />
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

      {isOwner ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800">{t("deleteTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-red-700">{t("deleteHint")}</p>
          <button type="button" onClick={() => setDeleteDialogOpen(true)} className="mt-4 halvaa-btn-danger cursor-pointer">
            {t("deleteAction")}
          </button>
        </div>
      ) : null}
        </>
      ) : null}

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
        {isOwner ? (
          <button type="button" onClick={() => setVisibilityDialogOpen(true)} disabled={saving} className="halvaa-btn-secondary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
            {memorial.status === "DEACTIVATED" ? t("reactivateMemorial") : t("deactivateMemorial")}
          </button>
        ) : null}
        <Link href={`/memorial/${memorial.slug}`} className="halvaa-btn-secondary inline-flex cursor-pointer">
          {tCommon("cancel")}
        </Link>
      </div>
      <MapboxLocationPicker
        open={pickerTarget !== null}
        locale={locale}
        value={selectedPickerValue}
        onPick={handleLocationPick}
        onClose={() => setPickerTarget(null)}
      />
    </form>
    <MediaPreviewDialog
      open={previewFiles.length > 0}
      files={previewFiles}
      title={t("previewUploadTitle")}
      hint={t("previewUploadHint")}
      confirmLabel={uploading ? t("uploading") : t("useSelectedMedia")}
      cancelLabel={tCommon("cancel")}
      removeLabel={t("mediaRemove")}
      onConfirm={() => void handleUploadFiles()}
      onClose={closeUploadPreview}
      onRemove={removePreviewFile}
    />
    {previewFiles.length > 0 && Object.keys(uploadProgress).length > 0 ? (
      <div className="fixed inset-x-4 bottom-4 z-[110] mx-auto max-w-xl rounded-lg border border-border bg-background p-3 shadow-soft">
        {previewFiles.map((item) => (
          <div key={item.id} className="mb-2 last:mb-0">
            <div className="flex justify-between gap-3 text-xs text-muted">
              <span className="truncate">{item.file.name}</span>
              <span>{uploadProgress[item.id] ?? 0}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-border">
              <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress[item.id] ?? 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    ) : null}
    <ConfirmDialog
      open={visibilityDialogOpen}
      title={memorial.status === "DEACTIVATED" ? t("reactivateMemorial") : t("deactivateMemorial")}
      description={memorial.status === "DEACTIVATED" ? t("reactivateConfirmSecond") : t("deactivateConfirmSecond")}
      confirmLabel={memorial.status === "DEACTIVATED" ? t("reactivateMemorial") : t("deactivateMemorial")}
      cancelLabel={tCommon("cancel")}
      busyLabel={t("saving")}
      busy={saving}
      tone={memorial.status === "DEACTIVATED" ? "primary" : "danger"}
      onConfirm={() => void handleVisibilityToggle()}
      onClose={() => setVisibilityDialogOpen(false)}
    />
    <ConfirmDialog
      open={deleteDialogOpen}
      title={t("deleteTitle")}
      description={t("deleteConfirm")}
      confirmLabel={t("deleteAction")}
      cancelLabel={tCommon("cancel")}
      busyLabel={t("deleting")}
      busy={deletingMemorial}
      tone="danger"
      onConfirm={() => void handleDeleteMemorial()}
      onClose={() => setDeleteDialogOpen(false)}
    />
    </>
  );
}
