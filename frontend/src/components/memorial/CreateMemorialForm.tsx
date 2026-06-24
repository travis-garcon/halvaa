"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useAuth } from "@/hooks/use-auth";
import { Link, useRouter } from "@/i18n/routing";
import { api, ApiError } from "@/lib/api-client";

const DRAFT_KEY = "halvaa:create-memorial-draft";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateMemorialForm() {
  const t = useTranslations("createMemorial");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { isAuthenticated, isLoading, zitadelLogin } = useAuth();

  const [fullName, setFullName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [biography, setBiography] = useState("");
  const [epitaph, setEpitaph] = useState("");
  const [latitude, setLatitude] = useState("35.6892");
  const [longitude, setLongitude] = useState("51.389");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const autoSlug = useMemo(() => slugify(fullName), [fullName]);
  const effectiveSlug = slugTouched ? slug : autoSlug;

  useEffect(() => {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as Partial<Record<"fullName" | "slug" | "birthDate" | "deathDate" | "biography" | "epitaph" | "latitude" | "longitude", string>>;
      /* eslint-disable react-hooks/set-state-in-effect */
      setFullName(draft.fullName ?? "");
      setSlug(draft.slug ?? "");
      setSlugTouched(Boolean(draft.slug));
      setBirthDate(draft.birthDate ?? "");
      setDeathDate(draft.deathDate ?? "");
      setBiography(draft.biography ?? "");
      setEpitaph(draft.epitaph ?? "");
      setLatitude(draft.latitude ?? "35.6892");
      setLongitude(draft.longitude ?? "51.389");
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ fullName, slug: effectiveSlug, birthDate, deathDate, biography, epitaph, latitude, longitude }),
    );
  }, [biography, birthDate, deathDate, effectiveSlug, epitaph, fullName, latitude, longitude]);

  const handleNameChange = (value: string) => {
    setFullName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  };

  const handleCreate = async (intent: "draft" | "submit") => {
    setSubmitting(true);
    setError(null);

    const finalSlug = effectiveSlug || slugify(fullName);
    if (!fullName.trim()) {
      setError(t("errorName"));
      setSubmitting(false);
      return;
    }
    if (!finalSlug) {
      setError(t("errorSlug"));
      setSubmitting(false);
      return;
    }

    const translationFields: Record<string, string> = { name: fullName.trim() };
    if (biography.trim()) translationFields.biography = biography.trim();
    if (epitaph.trim()) translationFields.epitaph = epitaph.trim();

    try {
      const memorial = await api.createMemorial({
        slug: finalSlug,
        birth_date: birthDate || null,
        death_date: deathDate || null,
        translations: {
          [locale]: translationFields,
        },
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
      });
      if (intent === "submit") {
        await api.updateMemorialStatus(memorial.id, "PENDING_APPROVAL");
        window.localStorage.removeItem(DRAFT_KEY);
        router.push(`/memorial/${memorial.slug}/edit?notice=submitted`);
        return;
      }
      window.localStorage.removeItem(DRAFT_KEY);
      router.push(`/memorial/${memorial.slug}/edit?notice=draft-created`);
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
    await handleCreate("draft");
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-sm text-muted">
        {tCommon("loading")}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center ltr:text-left rtl:text-right">
        <h2 className="text-xl font-semibold text-foreground">{t("signInRequired")}</h2>
        <p className="mt-2 text-sm text-muted">{t("signInBody")}</p>
        <p className="mt-4 text-sm font-medium text-foreground">{t("signInHint")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
          <button type="button" onClick={zitadelLogin} className="halvaa-btn-primary cursor-pointer">
            {tCommon("sign_in")}
          </button>
          <Link href="/explore" className="halvaa-btn-secondary inline-flex cursor-pointer">
            {tCommon("backExplore")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-border bg-background p-6 shadow-soft sm:p-8 ltr:text-left rtl:text-right"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{preview ? t("previewTitle") : t("draftTitle")}</p>
              <p className="mt-1 text-xs text-muted">{t("draftHint")}</p>
            </div>
            <button
              type="button"
              onClick={() => setPreview((value) => !value)}
              className="cursor-pointer rounded-full border border-border px-4 py-2 text-xs font-semibold transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {preview ? t("edit") : t("preview")}
            </button>
          </div>
        </div>

        {preview && (
          <div className="sm:col-span-2 rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t("preview")}</p>
            <h2 className="mt-3 text-2xl font-bold text-foreground">{fullName || t("fullName")}</h2>
            <p className="mt-2 font-mono text-xs text-muted">/{effectiveSlug || "memorial-link"}</p>
            {(birthDate || deathDate) && <p className="mt-4 text-sm text-muted">{birthDate || "—"} - {deathDate || "—"}</p>}
            {epitaph && <p className="mt-4 text-lg font-medium text-foreground">“{epitaph}”</p>}
            {biography && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">{biography}</p>}
            {(latitude || longitude) && <p className="mt-4 text-xs text-muted">{t("locationPreview", { latitude: latitude || "—", longitude: longitude || "—" })}</p>}
          </div>
        )}

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-foreground">{t("fullName")}</span>
          <input
            required
            type="text"
            value={fullName}
            onChange={(event) => handleNameChange(event.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]"
            autoComplete="name"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-foreground">{t("slug")}</span>
          <input
            required
            type="text"
            value={effectiveSlug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            className="w-full rounded-xl border border-border px-3 py-2 font-mono text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]"
          />
          <span className="mt-1 block text-xs text-muted">{t("slugHint")}</span>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("birthDate")}</span>
          <input
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("deathDate")}</span>
          <input
            type="date"
            value={deathDate}
            onChange={(event) => setDeathDate(event.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-foreground">{t("biography")}</span>
          <textarea
            rows={4}
            value={biography}
            onChange={(event) => setBiography(event.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-foreground">{t("epitaph")}</span>
          <input
            type="text"
            value={epitaph}
            onChange={(event) => setEpitaph(event.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("latitude")}</span>
          <input
            type="number"
            step="any"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-foreground">{t("longitude")}</span>
          <input
            type="number"
            step="any"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none transition focus:border-primary focus:shadow-[var(--shadow-focus)]"
          />
        </label>

        <div className="rounded-2xl border border-border bg-surface p-4 text-sm sm:col-span-2">
          <p className="font-semibold text-foreground">{t("workflowTitle")}</p>
          <p className="mt-1 text-xs text-muted">{t("workflowHint")}</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="halvaa-btn-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? t("submitting") : t("saveDraft")}
        </button>
        <button
          type="button"
          onClick={() => void handleCreate("submit")}
          disabled={submitting}
          className="halvaa-btn-secondary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? t("submitting") : t("submitForApproval")}
        </button>
        <Link href="/" className="halvaa-btn-secondary inline-flex cursor-pointer">
          {tCommon("cancel")}
        </Link>
      </div>
    </form>
  );
}
