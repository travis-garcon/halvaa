"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";

type ContributionBoxProps = {
  memorialId: string;
  locale: string;
};

export function ContributionBox({ memorialId, locale }: ContributionBoxProps) {
  const t = useTranslations("contribution");
  const { isAuthenticated } = useAuth();
  const [biography, setBiography] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      setMessage(t("signInRequired"));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api.createContribution(memorialId, {
        locale,
        biography: biography.trim(),
        source_note: sourceNote.trim() || null,
      });
      setBiography("");
      setSourceNote("");
      setMessage(t("submitted"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-[2rem] border border-border bg-background/95 p-5 shadow-soft sm:p-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("eyebrow")}</p>
        <h2 className="text-xl font-semibold text-foreground">{t("title")}</h2>
      </div>
      <textarea
        value={biography}
        onChange={(event) => setBiography(event.target.value)}
        placeholder={t("biographyPlaceholder")}
        className="mt-4 min-h-28 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm leading-6 outline-none focus:border-primary"
        required
      />
      <input
        value={sourceNote}
        onChange={(event) => setSourceNote(event.target.value)}
        placeholder={t("sourcePlaceholder")}
        className="mt-3 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-primary"
      />
      {message && <p className="mt-3 text-sm text-muted">{message}</p>}
      <button type="submit" disabled={busy} className="mt-4 halvaa-btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
