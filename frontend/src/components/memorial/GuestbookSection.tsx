"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { FormEvent, useState } from "react";
import { mutate } from "swr";

import { submitGuestbookEntry, useGuestbook } from "@/hooks/use-guestbook";
import { ApiError } from "@/lib/api-client";

type GuestbookSectionProps = {
  memorialId: string;
};

function SkeletonEntries() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading guestbook entries">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-[1.75rem] border border-border/80 bg-background p-5 shadow-soft">
          <div className="skeleton skeleton-text w-1/3" />
          <div className="skeleton skeleton-text mt-2 w-full" />
          <div className="skeleton skeleton-text w-4/5" />
          <div className="skeleton skeleton-text-sm mt-2" />
        </div>
      ))}
    </div>
  );
}

export function GuestbookSection({ memorialId }: GuestbookSectionProps) {
  const t = useTranslations("guestbook");
  const locale = useLocale();
  const { data: entries, isLoading, error } = useGuestbook(memorialId);
  const [authorName, setAuthorName] = useState("");
  const [tributeType, setTributeType] = useState<"MESSAGE" | "TRIBUTE" | "PRAYER" | "POEM">("MESSAGE");
  const [relationshipLabel, setRelationshipLabel] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedAuthor = authorName.trim();
    const trimmedMessage = message.trim();
    if (!trimmedAuthor || !trimmedMessage) {
      setFeedback({ text: t("validationRequired"), type: "error" });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      await submitGuestbookEntry(memorialId, {
        author_name: trimmedAuthor,
        message: trimmedMessage,
        tribute_type: tributeType,
        relationship_label: relationshipLabel.trim() || null,
      });
      setAuthorName("");
      setTributeType("MESSAGE");
      setRelationshipLabel("");
      setMessage("");
      setFeedback({ text: t("submitSuccess"), type: "success" });
      await mutate(["guestbook", memorialId]);
    } catch (err) {
      const detail = err instanceof ApiError ? err.message : t("submitError");
      setFeedback({ text: detail, type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-entrance space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{t("eyebrow")}</p>
        <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("title")}</h2>
        <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">{t("subtitle")}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-[2rem] border border-border bg-background/95 p-6 shadow-soft sm:p-8"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-foreground/80">{t("authorLabel")}</span>
            <input
              required
              maxLength={255}
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              disabled={submitting}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-foreground/80">{t("tributeTypeLabel")}</span>
            <select
              value={tributeType}
              onChange={(event) => setTributeType(event.target.value as "MESSAGE" | "TRIBUTE" | "PRAYER" | "POEM")}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              disabled={submitting}
            >
              {["MESSAGE", "TRIBUTE", "PRAYER", "POEM"].map((type) => (
                <option key={type} value={type}>{t(`tributeTypes.${type}`)}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-2 block font-medium text-foreground/80">{t("relationshipLabel")}</span>
          <input
            maxLength={120}
            value={relationshipLabel}
            onChange={(event) => setRelationshipLabel(event.target.value)}
            placeholder={t("relationshipPlaceholder")}
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            disabled={submitting}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-2 block font-medium text-foreground/80">{t("messageLabel")}</span>
          <textarea
            required
            maxLength={4000}
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="w-full rounded-[1.5rem] border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              disabled={submitting}
          />
          <span className="mt-1 block text-xs text-muted">
            {t("charactersRemaining", { count: Math.max(4000 - message.length, 0) })}
          </span>
        </label>
        <button
          type="submit"
          disabled={submitting}
          className={"halvaa-btn-primary cursor-pointer disabled:cursor-wait disabled:opacity-60" + (submitting ? " btn-loading" : "")}
        >
          <span>{submitting ? t("submitting") : t("submit")}</span>
        </button>
        {feedback && (
          <p
            className={"rounded-[1.25rem] px-4 py-3 text-sm " + (feedback.type === "success" ? "feedback-success" : "feedback-error")}
            role={feedback.type === "error" ? "alert" : "status"}
          >
            {feedback.text}
          </p>
        )}
      </form>

      {isLoading && <SkeletonEntries />}

      {error && (
        <p className="rounded-[1.5rem] border border-border bg-background px-4 py-3 text-sm text-muted" role="alert">
          {t("loadError")}
        </p>
      )}

      {!isLoading && !error && (entries ?? []).length === 0 && (
        <p className="rounded-[1.5rem] border border-dashed border-border bg-background/80 px-5 py-6 text-sm text-muted">{t("empty")}</p>
      )}

      {!isLoading && !error && (entries ?? []).length > 0 && (
        <ul className="space-y-4">
          {(entries ?? []).map((entry, index) => (
            <li
              key={entry.id}
              className="stagger-enter stagger-enter-active rounded-[1.75rem] border border-border bg-background/95 p-5 shadow-soft ltr:text-left rtl:text-right"
              style={{ transitionDelay: `${Math.min(index * 30, 200)}ms` }}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
                <span className="rounded-full border border-border px-3 py-1">{t(`tributeTypes.${entry.tribute_type}`)}</span>
                {entry.relationship_label ? <span>{entry.relationship_label}</span> : null}
              </div>
              <p className="text-base font-semibold text-foreground">{entry.author_name}</p>
              <p className="mt-3 text-sm leading-8 text-foreground/80">{entry.message}</p>
              <time className="mt-3 block text-xs font-medium text-muted" dateTime={entry.created_at}>
                {new Date(entry.created_at).toLocaleDateString(locale)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
