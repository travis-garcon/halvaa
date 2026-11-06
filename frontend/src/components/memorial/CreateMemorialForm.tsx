"use client";

import "swiper/css";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Swiper, SwiperSlide } from "swiper/react";

import { useAuth } from "@/hooks/use-auth";
import { Link, useRouter } from "@/i18n/routing";
import { api, ApiError } from "@/lib/api-client";
import { openAuthModal } from "@/lib/auth-modal-events";
import { buildMemorialDetailsPayload, DEFAULT_MEMORIAL_FORM_STATE, type MemorialDetailsFormState } from "@/lib/memorial-form";
import { MapboxLocationPicker, type PickedLocation } from "@/components/ui/MapboxLocationPicker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FieldLabel } from "@/components/ui/InfoTip";
import { LocalizedDateInput } from "@/components/ui/LocalizedDateInput";
import { MEDIA_SIZE_LIMITS, MediaPreviewDialog, formatFileSize, preparePreviewFiles, type PreviewFile } from "@/components/ui/MediaPreviewDialog";
import { notifyApp } from "@/components/ui/AppNotifications";

const DRAFT_KEY = "halvaa:create-memorial-draft";
const DRAFT_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const STEPS = ["identity", "story", "media"] as const;

type DraftMemorial = {
  id: string;
  slug: string;
};

type HeaderRole = "portrait" | "banner" | null;

type StagedMedia = {
  id: string;
  file: File;
  previewUrl: string | null;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  headerRole: HeaderRole;
  errorMessage?: string | null;
};

type PreviewTarget = "portrait" | "banner" | "gallery";

export function CreateMemorialForm() {
  const t = useTranslations("createMemorial");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  const [form, setForm] = useState<MemorialDetailsFormState>(DEFAULT_MEMORIAL_FORM_STATE);
  const [step, setStep] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<StagedMedia[]>([]);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>("gallery");
  const [dragTarget, setDragTarget] = useState<PreviewTarget | null>(null);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [blankConfirmOpen, setBlankConfirmOpen] = useState(false);
  const [clearingDraft, setClearingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftMemorial, setDraftMemorial] = useState<DraftMemorial | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaFilesRef = useRef<StagedMedia[]>([]);
  const draftRef = useRef<DraftMemorial | null>(null);
  const autosavePromiseRef = useRef<Promise<unknown> | null>(null);
  const currentStep = STEPS[step];

  const updateField = (field: keyof MemorialDetailsFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const discardStaleDraft = () => {
    draftRef.current = null;
    setDraftMemorial(null);
    window.localStorage.removeItem(DRAFT_KEY);
  };

  const addFamilyMember = () => {
    setForm((current) => ({
      ...current,
      familyTree: [...current.familyTree, { id: crypto.randomUUID(), name: "", relation: "", years: "" }],
    }));
  };

  const updateFamilyMember = (index: number, next: Partial<(typeof form.familyTree)[number]>) => {
    setForm((current) => ({
      ...current,
      familyTree: current.familyTree.map((member, currentIndex) => (currentIndex === index ? { ...member, ...next } : member)),
    }));
  };

  const removeFamilyMember = (index: number) => {
    setForm((current) => ({
      ...current,
      familyTree: current.familyTree.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const dateLabels = {
    persian: t("calendar.persian"),
    gregorian: t("calendar.gregorian"),
    year: t("calendar.year"),
    month: t("calendar.month"),
    day: t("calendar.day"),
    converted: t("calendar.converted"),
    empty: t("calendar.empty"),
  };

  useEffect(() => {
    if (isLoading) return;
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as {
        savedAt?: number;
        ownerId?: string;
        form?: Partial<MemorialDetailsFormState>;
        memorial?: DraftMemorial | null;
      };
      if (!user?.id || draft.ownerId !== user.id) {
        window.localStorage.removeItem(DRAFT_KEY);
        return;
      }
      if (Date.now() - (draft.savedAt ?? Date.now()) > DRAFT_TTL_MS) {
        window.localStorage.removeItem(DRAFT_KEY);
        return;
      }
      setForm((current) => ({ ...current, ...(draft.form ?? {}) }));
      if (draft.memorial) {
        draftRef.current = draft.memorial;
        setDraftMemorial(draft.memorial);
      }
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [isLoading, user?.id]);

  useEffect(() => {
    if (isLoading || !user?.id) return;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), ownerId: user?.id, form, memorial: draftMemorial }));
  }, [draftMemorial, form, isLoading, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !form.fullName.trim() || submitting) return;
    const timer = window.setTimeout(() => {
      setAutosaveState("saving");
      const promise = (async () => {
        try {
          const payload = buildMemorialDetailsPayload(form, locale);
          let saved;
          if (draftRef.current) {
            try {
              saved = await api.updateMemorial(draftRef.current.id, payload);
            } catch (updateError) {
              if (!(updateError instanceof ApiError) || ![403, 404].includes(updateError.status)) throw updateError;
              discardStaleDraft();
              saved = await api.createMemorial({ slug: null, status: "DRAFT", ...payload });
            }
          } else {
            saved = await api.createMemorial({ slug: null, status: "DRAFT", ...payload });
          }
          const nextDraft = { id: saved.id, slug: saved.slug };
          draftRef.current = nextDraft;
          setDraftMemorial(nextDraft);
          setAutosaveState("saved");
        } catch (autosaveError) {
          if (autosaveError instanceof ApiError && [403, 404].includes(autosaveError.status)) discardStaleDraft();
          setAutosaveState("error");
        }
      })();
      autosavePromiseRef.current = promise;
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [form, isAuthenticated, locale, submitting]);

  useEffect(() => {
    mediaFilesRef.current = mediaFiles;
  }, [mediaFiles]);

  useEffect(() => () => {
    mediaFilesRef.current.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  const validateStep = (targetStep = currentStep) => {
    if (targetStep === "identity" && !form.fullName.trim()) {
      setError(t("errorName"));
      return false;
    }
    setError(null);
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  };

  const openFilePreview = (files: File[], target: PreviewTarget) => {
    if (files.length === 0) return;
    const limited = target === "gallery" ? files : files.slice(0, 1);
    setPreviewTarget(target);
    setPreviewFiles(
      preparePreviewFiles(
        limited,
        t("uploadInvalidType"),
        (size) => t("uploadTooLarge", { size }),
      ),
    );
  };

  const closeFilePreview = () => {
    previewFiles.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setPreviewFiles([]);
  };

  const removePreviewFile = (id: string) => {
    setPreviewFiles((current) => {
      const selected = current.find((item) => item.id === id);
      if (selected?.previewUrl) URL.revokeObjectURL(selected.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const confirmPreviewFiles = () => {
    const role: HeaderRole = previewTarget === "gallery" ? null : previewTarget;
    setMediaFiles((current) => {
      const withoutRole = role ? current.filter((item) => item.headerRole !== role) : current;
      return [
        ...withoutRole,
        ...previewFiles.map((item) => ({
          id: item.id,
          file: item.file,
          previewUrl: item.previewUrl,
          status: "pending" as const,
          progress: 0,
          headerRole: role,
        })),
      ];
    });
    setPreviewFiles([]);
  };

  const removeMediaFile = (id: string) => {
    setMediaFiles((current) => {
      const selected = current.find((item) => item.id === id);
      if (selected?.previewUrl) URL.revokeObjectURL(selected.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>, target: PreviewTarget) => {
    event.preventDefault();
    setDragTarget(null);
    openFilePreview(Array.from(event.dataTransfer.files), target);
  };

  const updateUploadProgress = (id: string, progress: number) => {
    setMediaFiles((current) => current.map((item) => (item.id === id ? { ...item, progress } : item)));
  };

  const describeUploadError = (file: File, uploadError: unknown): string => {
    if (!(uploadError instanceof ApiError)) return t("uploadNetworkError");
    if (uploadError.status === 413) {
      const limit = file.type.startsWith("video/") ? MEDIA_SIZE_LIMITS.video : MEDIA_SIZE_LIMITS.image;
      return t("uploadTooLarge", { size: formatFileSize(limit) });
    }
    if (uploadError.status === 429) return t("uploadRateLimited");
    if (uploadError.status === 0) return t("uploadNetworkError");
    return uploadError.message;
  };

  const handleCreate = async () => {
    if (!validateStep("identity")) return;
    setSubmitting(true);
    setError(null);

    try {
      if (autosavePromiseRef.current) await autosavePromiseRef.current;
      const payload = buildMemorialDetailsPayload(form, locale);
      // Keep the server record private while media is uploaded. A memorial is
      // only made public after every selected file and header assignment works.
      let memorial;
      if (draftRef.current) {
        try {
          memorial = await api.updateMemorial(draftRef.current.id, payload);
        } catch (updateError) {
          if (!(updateError instanceof ApiError) || ![403, 404].includes(updateError.status)) throw updateError;
          discardStaleDraft();
          memorial = await api.createMemorial({ slug: null, status: "DRAFT", ...payload });
        }
      } else {
        memorial = await api.createMemorial({ slug: null, status: "DRAFT", ...payload });
      }
      draftRef.current = { id: memorial.id, slug: memorial.slug };
      setDraftMemorial(draftRef.current);
      let uploadFailed = false;
      const uploadFailureDetails: string[] = [];

      for (const item of mediaFiles) {
        if (item.status === "done") continue;
        setMediaFiles((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: "uploading", progress: 0, errorMessage: null } : entry)));
        try {
          const category = item.headerRole === "portrait" ? "AVATAR" : "GALLERY";
          const uploaded = await api.uploadMedia(memorial.id, item.file, category, (progress) => updateUploadProgress(item.id, progress));
          if (item.headerRole) {
            await api.updateMedia(memorial.id, uploaded.id, {
              translations: { meta: { header_role: item.headerRole } },
            });
          }
          setMediaFiles((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: "done", progress: 100 } : entry)));
        } catch (uploadError) {
          uploadFailed = true;
          const failureReason = describeUploadError(item.file, uploadError);
          uploadFailureDetails.push(`${item.file.name}: ${failureReason}`);
          setMediaFiles((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status: "error", errorMessage: failureReason } : entry)));
          console.error("Memorial media upload failed", uploadError);
        }
      }

      if (uploadFailed) {
        const message = t("publishMediaErrorDetail", { details: uploadFailureDetails.join(" • ") });
        setError(message);
        notifyApp({ message, tone: "error", durationMs: 9000 });
        return;
      }
      memorial = await api.updateMemorialStatus(memorial.id, "PUBLISHED");
      window.localStorage.removeItem(DRAFT_KEY);
      draftRef.current = null;
      setDraftMemorial(null);
      notifyApp({
        message: uploadFailed ? t("publishMediaWarning") : t("publishSuccess"),
        tone: uploadFailed ? "warning" : "success",
        durationMs: 7000,
      });
      router.push(`/memorial/${memorial.slug}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError(t("errorAuth"));
      } else {
        setError(err instanceof ApiError ? err.message : t("errorGeneric"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < STEPS.length - 1) {
      goNext();
      return;
    }
    if (!agreementAccepted) {
      setAgreementOpen(true);
      return;
    }
    await handleCreate();
  };

  const clearDraft = async () => {
    setClearingDraft(true);
    let clearError: unknown = null;
    try {
      if (draftRef.current) await api.deleteMemorial(draftRef.current.id);
    } catch (error) {
      clearError = error;
      if (!(error instanceof ApiError) || ![403, 404].includes(error.status)) {
        setError(error instanceof ApiError ? error.message : t("errorGeneric"));
      }
    } finally {
      mediaFiles.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      draftRef.current = null;
      setDraftMemorial(null);
      setForm(DEFAULT_MEMORIAL_FORM_STATE);
      setMediaFiles([]);
      setStep(0);
      setAgreementAccepted(false);
      window.localStorage.removeItem(DRAFT_KEY);
      setBlankConfirmOpen(false);
      setAutosaveState("idle");
      if (!clearError || (clearError instanceof ApiError && [403, 404].includes(clearError.status))) {
        setError(null);
      }
      setClearingDraft(false);
    }
  };

  const selectedPickerValue =
    form.latitude && form.longitude
      ? { latitude: Number(form.latitude), longitude: Number(form.longitude) }
      : null;

  const handleLocationPick = (location: PickedLocation) => {
    setForm((current) => ({
      ...current,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      locations: [{
        kind: "burial",
        label: current.burialSiteName,
        address: current.burialAddress,
        latitude: location.latitude,
        longitude: location.longitude,
      }],
    }));
  };

  const portrait = mediaFiles.find((item) => item.headerRole === "portrait");
  const banner = mediaFiles.find((item) => item.headerRole === "banner");
  const gallery = mediaFiles.filter((item) => item.headerRole === null);
  const autosaveLabel = useMemo(() => {
    if (autosaveState === "saving") return t("autosave.saving");
    if (autosaveState === "saved") return t("autosave.saved");
    if (autosaveState === "error") return t("autosave.error");
    return t("autosave.waiting");
  }, [autosaveState, t]);

  if (isLoading) {
    return <div className="rounded-lg border border-border bg-background p-8 text-sm text-muted">{tCommon("loading")}</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-border bg-background p-8 text-center ltr:text-left rtl:text-right">
        <h2 className="text-xl font-semibold text-foreground">{t("signInRequired")}</h2>
        <p className="mt-2 text-sm text-muted">{t("signInBody")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
          <button type="button" onClick={openAuthModal} className="halvaa-btn-primary cursor-pointer">{tCommon("sign_in")}</button>
          <Link href="/explore" className="halvaa-btn-secondary inline-flex cursor-pointer">{tCommon("backExplore")}</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-border bg-background p-4 shadow-soft sm:p-7 ltr:text-left rtl:text-right">
        <div className="border-b border-border pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{t("wizardTitle")}</p>
              <p className="mt-1 text-xs text-muted">{autosaveLabel}</p>
            </div>
            <button type="button" onClick={() => setBlankConfirmOpen(true)} className="rounded-md border-2 border-primary px-3 py-2 text-sm font-extrabold text-primary shadow-sm transition hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              {t("blankForm")}
            </button>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {STEPS.map((stepKey, index) => (
              <button
                key={stepKey}
                type="button"
                onClick={() => {
                  if (index <= step || validateStep()) setStep(index);
                }}
                className={["memorial-step-tab", index === step ? "is-active" : ""].join(" ")}
              >
                <span>{index + 1}</span>
                <strong>{t(`steps.${stepKey}`)}</strong>
              </button>
            ))}
          </div>
        </div>

        {currentStep === "identity" ? (
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <h2 className="text-lg font-semibold text-foreground">{t("sections.identityTitle")}</h2>
              <p className="mt-1 text-sm text-muted">{t("sections.identityHint")}</p>
            </div>
            <label className="block text-sm sm:col-span-2">
              <FieldLabel label={t("fullName")} help={t("help.fullName")} />
              <input required type="text" value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]" autoComplete="off" dir="auto" />
            </label>
            <label className="block text-sm">
              <FieldLabel label={t("birthDate")} help={t("help.birthDate")} />
              <LocalizedDateInput locale={locale} value={form.birthDate} onChange={(value) => updateField("birthDate", value)} labels={dateLabels} />
            </label>
            <label className="block text-sm">
              <FieldLabel label={t("deathDate")} help={t("help.deathDate")} />
              <LocalizedDateInput locale={locale} value={form.deathDate} onChange={(value) => updateField("deathDate", value)} labels={dateLabels} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <FieldLabel label={t("occupation")} help={t("help.occupation")} />
              <input value={form.occupation} onChange={(event) => updateField("occupation", event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary" dir="auto" />
            </label>
          </section>
        ) : null}

        {currentStep === "story" ? (
          <section className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("sections.storyTitle")}</h2>
              <p className="mt-1 text-sm text-muted">{t("sections.storyHint")}</p>
            </div>
            <label className="block text-sm">
              <FieldLabel label={t("biography")} help={t("help.biography")} />
              <textarea rows={6} value={form.biography} onChange={(event) => updateField("biography", event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary" dir="auto" />
            </label>
            <label className="block text-sm">
              <FieldLabel label={t("epitaph")} help={t("help.epitaph")} />
              <input value={form.epitaph} onChange={(event) => updateField("epitaph", event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary" dir="auto" />
            </label>

            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{t("familyTreeTitle")}</p>
                  <p className="mt-1 text-xs text-muted">{t("help.familyTree")}</p>
                </div>
                <button type="button" onClick={addFamilyMember} className="halvaa-btn-secondary cursor-pointer px-4 py-2 text-xs">{t("familyTreeAdd")}</button>
              </div>
              <div className="mt-4 space-y-3">
                {form.familyTree.map((member, index) => (
                  <div key={member.id ?? `family-${index}`} className="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-3">
                    <label className="text-xs">
                      <FieldLabel label={t("familyTreeName")} help={t("help.familyName")} />
                      <input value={member.name} onChange={(event) => updateFamilyMember(index, { name: event.target.value })} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" dir="auto" />
                    </label>
                    <label className="text-xs">
                      <FieldLabel label={t("familyTreeRelation")} help={t("help.familyRelation")} />
                      <input value={member.relation} onChange={(event) => updateFamilyMember(index, { relation: event.target.value })} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" dir="auto" />
                    </label>
                    <label className="text-xs">
                      <FieldLabel label={t("familyTreeYears")} help={t("help.familyYears")} />
                      <input value={member.years ?? ""} onChange={(event) => updateFamilyMember(index, { years: event.target.value })} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" dir="auto" />
                    </label>
                    <button type="button" onClick={() => removeFamilyMember(index)} className="text-xs font-semibold text-red-600 sm:col-span-3 sm:justify-self-end">{t("remove")}</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="font-semibold text-foreground">{t("restingPlaceTitle")}</p>
                <p className="mt-1 text-xs text-muted">{t("help.restingPlace")}</p>
              </div>
              <label className="text-sm">
                <FieldLabel label={t("burialSiteName")} help={t("help.burialSiteName")} />
                <input value={form.burialSiteName} onChange={(event) => updateField("burialSiteName", event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" dir="auto" />
              </label>
              <label className="text-sm">
                <FieldLabel label={t("burialAddress")} help={t("help.burialAddress")} />
                <input value={form.burialAddress} onChange={(event) => updateField("burialAddress", event.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" dir="auto" />
              </label>
              <button type="button" onClick={() => setPickerOpen(true)} className="halvaa-btn-secondary cursor-pointer sm:col-span-2">{t("pickLocation")}</button>
            </div>
          </section>
        ) : null}

        {currentStep === "media" ? (
          <section className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("sections.mediaTitle")}</h2>
              <p className="mt-1 text-sm text-muted">{t("sections.mediaHint")}</p>
            </div>

            <div className="memorial-header-preview">
              <div className="memorial-header-preview-banner">
                {banner?.previewUrl ? <img src={banner.previewUrl} alt={banner.file.name} /> : <span>{t("bannerPreviewEmpty")}</span>}
              </div>
              <div className="memorial-header-preview-portrait">
                {portrait?.previewUrl ? <img src={portrait.previewUrl} alt={portrait.file.name} /> : <span>?</span>}
              </div>
              <p>{form.fullName || t("fullName")}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(["banner", "portrait"] as const).map((target) => (
                <label
                  key={target}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragTarget(target);
                  }}
                  onDragLeave={() => setDragTarget(null)}
                  onDrop={(event) => handleDrop(event, target)}
                  className={["media-drop-zone", dragTarget === target ? "is-active" : ""].join(" ")}
                >
                  <FieldLabel label={target === "banner" ? t("bannerImage") : t("portraitImage")} help={t(`help.${target}`)} />
                  <span>{t("choosePhoto")}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => openFilePreview(Array.from(event.target.files ?? []), target)} />
                </label>
              ))}
            </div>

            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragTarget("gallery");
              }}
              onDragLeave={() => setDragTarget(null)}
              onDrop={(event) => handleDrop(event, "gallery")}
              className={["media-drop-zone", dragTarget === "gallery" ? "is-active" : ""].join(" ")}
            >
              <FieldLabel label={t("galleryUploadTitle")} help={t("help.gallery")} />
              <span>{t("chooseMedia")}</span>
              <small>{t("mediaUploadHint")}</small>
                  <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" multiple className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => openFilePreview(Array.from(event.target.files ?? []), "gallery")} />
            </label>

            {gallery.length > 0 ? (
              <div>
                <p className="mb-3 text-sm font-semibold text-foreground">{t("galleryPreviewTitle")}</p>
                <Swiper spaceBetween={12} slidesPerView={1.15} breakpoints={{ 640: { slidesPerView: 2.2 }, 1024: { slidesPerView: 3.2 } }}>
                  {gallery.map((item) => (
                    <SwiperSlide key={item.id}>
                      <article className="overflow-hidden rounded-lg border border-border bg-surface">
                        <div className="flex aspect-video items-center justify-center overflow-hidden bg-background">
                          {item.file.type.startsWith("video/") && item.previewUrl ? (
                            <video src={item.previewUrl} controls playsInline preload="metadata" className="h-full w-full object-cover" />
                          ) : item.previewUrl ? (
                            <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="p-3">
                          <p className="truncate text-xs font-semibold text-foreground">{item.file.name}</p>
                          <button type="button" onClick={() => removeMediaFile(item.id)} className="mt-2 text-xs font-semibold text-red-600">{t("remove")}</button>
                        </div>
                      </article>
                    </SwiperSlide>
                  ))}
                </Swiper>
              </div>
            ) : null}

            {mediaFiles.some((item) => item.status !== "pending") ? (
              <div className="space-y-3">
                {mediaFiles.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-semibold text-foreground">{item.file.name}</span>
                      <span className="text-muted">{item.progress}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
                      <div className={["h-full transition-all", item.status === "error" ? "bg-red-600" : "bg-primary"].join(" ")} style={{ width: `${item.progress}%` }} />
                    </div>
                    {item.errorMessage ? <p className="mt-2 text-xs font-semibold text-red-600">{item.errorMessage}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}

        <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5">
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep((value) => Math.max(value - 1, 0))} disabled={step === 0 || submitting} className="halvaa-btn-secondary cursor-pointer disabled:opacity-50">{t("back")}</button>
            <Link href="/" className="halvaa-btn-secondary inline-flex cursor-pointer">{tCommon("cancel")}</Link>
          </div>
          {step < STEPS.length - 1 ? (
            <button type="submit" className="halvaa-btn-primary cursor-pointer">{t("next")}</button>
          ) : (
            <button type="submit" disabled={submitting} className="halvaa-btn-primary cursor-pointer disabled:opacity-60">
              {submitting ? t("submittingWithMedia") : t("publish")}
            </button>
          )}
        </div>
      </form>

      <MediaPreviewDialog
        open={previewFiles.length > 0}
        files={previewFiles}
        title={t("previewUploadTitle")}
        hint={t("previewUploadHint")}
        confirmLabel={t("useSelectedMedia")}
        cancelLabel={tCommon("cancel")}
        removeLabel={t("remove")}
        onConfirm={confirmPreviewFiles}
        onClose={closeFilePreview}
        onRemove={removePreviewFile}
      />

      <ConfirmDialog
        open={blankConfirmOpen}
        title={t("blankForm")}
        description={t("blankConfirm")}
        confirmLabel={t("blankContinue")}
        cancelLabel={tCommon("cancel")}
        busyLabel={t("blankClearing")}
        busy={clearingDraft}
        tone="danger"
        onConfirm={() => void clearDraft()}
        onClose={() => setBlankConfirmOpen(false)}
      />

      <ConfirmDialog
        open={agreementOpen}
        title={t("agreementTitle")}
        description={t("agreementIntro")}
        confirmLabel={t("agreementContinue")}
        cancelLabel={tCommon("cancel")}
        busyLabel={t("submittingWithMedia")}
        busy={submitting}
        onConfirm={() => {
          if (!agreementAccepted) return;
          setAgreementOpen(false);
          void handleCreate();
        }}
        onClose={() => setAgreementOpen(false)}
      >
        <ul className="list-disc space-y-2 px-5 text-sm leading-7 text-muted">
          <li>{t("agreementRules.lawful")}</li>
          <li>{t("agreementRules.personal")}</li>
          <li>{t("agreementRules.safety")}</li>
          <li>{t("agreementRules.alivePeople")}</li>
          <li>{t("agreementRules.admin")}</li>
        </ul>
        <label className="mt-4 flex items-start gap-3 text-sm text-foreground">
          <input type="checkbox" checked={agreementAccepted} onChange={(event) => setAgreementAccepted(event.target.checked)} className="mt-1 h-4 w-4" />
          <span>{t("agreementAccept")}</span>
        </label>
      </ConfirmDialog>

      <MapboxLocationPicker
        open={pickerOpen}
        locale={locale}
        value={selectedPickerValue}
        onPick={handleLocationPick}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}
