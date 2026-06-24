"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useCollaboratorInvitations } from "@/hooks/use-collaborator-invitations";
import { Link } from "@/i18n/routing";
import { api, ApiError } from "@/lib/api-client";

function getName(memorial: Awaited<ReturnType<typeof api.myMemorials>>[number], locale: string): string {
  return memorial.translations?.[locale]?.name ?? memorial.translations?.en?.name ?? memorial.slug;
}

function formatDateTime(value: string | null | undefined, locale: string): string | null {
  if (!value) {
    return null;
  }
  return new Date(value).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ProfileDashboard() {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const tStatuses = useTranslations("editMemorial.statuses");
  const { user, isAuthenticated, isLoading, zitadelLogin } = useAuth();
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [reviewingMemorialId, setReviewingMemorialId] = useState<string | null>(null);
  const { data: memorials = [], isLoading: memorialsLoading } = useSWR(
    isAuthenticated ? ["profile", "my-memorials"] : null,
    () => api.myMemorials(),
  );
  const { data: invitations, mutate: mutateInvitations } = useCollaboratorInvitations(isAuthenticated);
  const { data: approvalQueue = [], mutate: mutateApprovalQueue } = useSWR(
    isAuthenticated ? ["profile", "approval-queue", user?.locale ?? "en"] : null,
    () => api.pendingMemorialApprovals(user?.locale ?? "en"),
  );
  const { data: moderationQueue = [], mutate: mutateModerationQueue } = useSWR(
    isAuthenticated ? ["profile", "moderation-queue"] : null,
    () => api.pendingGuestbookQueue(user?.locale ?? "en"),
  );
  const moderationGroups = Object.values(
    moderationQueue.reduce<Record<string, { memorialId: string; memorialSlug: string; memorialName: string; items: typeof moderationQueue }>>((groups, entry) => {
      const existing = groups[entry.memorial_id] ?? {
        memorialId: entry.memorial_id,
        memorialSlug: entry.memorial_slug,
        memorialName: entry.memorial_name ?? entry.memorial_slug,
        items: [],
      };
      existing.items.push(entry);
      groups[entry.memorial_id] = existing;
      return groups;
    }, {}),
  );
  const totalReviewItems = approvalQueue.length + moderationQueue.length;
  const getStatusLabel = (status: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "FEATURED") => tStatuses(status);

  const handleAcceptInvitation = async (collaboratorId: string) => {
    setAcceptingId(collaboratorId);
    setInviteMessage(null);
    try {
      await api.acceptCollaboratorInvitation(collaboratorId);
      await Promise.all([mutateInvitations(), globalMutate(["profile", "my-memorials"])]);
      setInviteMessage(t("invitations.accepted"));
    } catch (error) {
      setInviteMessage(error instanceof ApiError ? error.message : t("invitations.error"));
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDeclineInvitation = async (collaboratorId: string) => {
    setDecliningId(collaboratorId);
    setInviteMessage(null);
    try {
      await api.declineCollaboratorInvitation(collaboratorId);
      await mutateInvitations();
      setInviteMessage(t("invitations.declined"));
    } catch (error) {
      setInviteMessage(error instanceof ApiError ? error.message : t("invitations.error"));
    } finally {
      setDecliningId(null);
    }
  };

  const handleModerateQueueEntry = async (memorialId: string, entryId: string, status: "APPROVED" | "REJECTED") => {
    setModeratingId(entryId);
    setReviewMessage(null);
    try {
      await api.moderateGuestbookEntry(memorialId, entryId, status);
      await mutateModerationQueue();
      setReviewMessage(status === "APPROVED" ? t("moderation.approved") : t("moderation.rejected"));
    } catch (error) {
      setReviewMessage(error instanceof ApiError ? error.message : t("moderation.error"));
    } finally {
      setModeratingId(null);
    }
  };

  const handleReviewMemorial = async (memorialId: string, decision: "APPROVE" | "REQUEST_CHANGES" | "FEATURE") => {
    setReviewingMemorialId(memorialId);
    setReviewMessage(null);
    try {
      await api.reviewMemorial(memorialId, decision);
      await mutateApprovalQueue();
      setReviewMessage(
        decision === "APPROVE"
          ? t("approvals.approved")
          : decision === "FEATURE"
            ? t("approvals.featured")
            : t("approvals.requestedChanges"),
      );
    } catch (error) {
      setReviewMessage(error instanceof ApiError ? error.message : t("approvals.error"));
    } finally {
      setReviewingMemorialId(null);
    }
  };

  if (isLoading) {
    return <div className="rounded-2xl border border-border bg-background p-6 text-sm text-muted">{t("loading")}</div>;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="rounded-2xl border border-border bg-background p-6 shadow-soft">
        <h2 className="text-xl font-semibold text-foreground">{t("signInTitle")}</h2>
        <p className="mt-2 text-sm text-muted">{t("signInBody")}</p>
        <div className="mt-5 flex flex-wrap gap-3">
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

  const drafts = memorials.filter((memorial) => memorial.status === "DRAFT").length;
  const published = memorials.filter((memorial) => memorial.status === "PUBLISHED" || memorial.status === "FEATURED").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background p-5 shadow-soft">
          <p className="text-sm text-muted">{t("account")}</p>
          <p className="mt-2 font-semibold text-foreground">{user.full_name}</p>
          <p className="mt-1 text-xs text-muted">{user.email}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-5 shadow-soft">
          <p className="text-sm text-muted">{t("stats.memorials")}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{memorials.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-5 shadow-soft">
          <p className="text-sm text-muted">{t("published")}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{published}</p>
          <p className="mt-1 text-xs text-muted">{t("drafts", { count: drafts })}</p>
        </div>
      </div>

      <div className="rounded-[2rem] border border-border bg-background p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{t("invitations.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("invitations.subtitle")}</p>
          </div>
        </div>

        {inviteMessage && <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm text-foreground">{inviteMessage}</p>}

        {(invitations?.items.length ?? 0) === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">{t("invitations.empty")}</div>
        ) : (
          <div className="mt-6 space-y-3">
            {(invitations?.items ?? []).map((invitation) => (
              <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-4">
                <div>
                  <p className="font-semibold text-foreground">{invitation.memorial_name ?? invitation.memorial_slug}</p>
                  <p className="mt-1 text-xs text-muted">/{invitation.memorial_slug} · {t(`roles.${invitation.role}`)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAcceptInvitation(invitation.id)}
                  disabled={acceptingId === invitation.id || decliningId === invitation.id}
                  className="halvaa-btn-secondary cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {acceptingId === invitation.id ? t("invitations.accepting") : t("invitations.accept")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeclineInvitation(invitation.id)}
                  disabled={acceptingId === invitation.id || decliningId === invitation.id}
                  className="inline-flex cursor-pointer items-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {decliningId === invitation.id ? t("invitations.declining") : t("invitations.decline")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[2rem] border border-border bg-background p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{t("reviewCenter.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("reviewCenter.subtitle")}</p>
          </div>
          <div className="flex gap-3 text-sm text-muted">
            {user.is_superuser ? <span>{t("approvals.stats.pending", { count: approvalQueue.length })}</span> : null}
            <span>{t("moderation.stats.entries", { count: moderationQueue.length })}</span>
          </div>
        </div>

        {reviewMessage ? <p className="mt-4 rounded-xl bg-surface px-4 py-3 text-sm text-foreground">{reviewMessage}</p> : null}

        {totalReviewItems === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">{t("reviewCenter.empty")}</div>
        ) : (
          <div className="mt-6 space-y-6">
            {user.is_superuser && approvalQueue.length > 0 ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{t("approvals.title")}</h3>
                    <p className="mt-1 text-sm text-muted">{t("approvals.subtitle")}</p>
                  </div>
                  <div className="text-sm text-muted">{t("approvals.stats.pending", { count: approvalQueue.length })}</div>
                </div>

                <div className="mt-4 space-y-3">
                  {approvalQueue.map((memorial) => {
                    const submittedAt = formatDateTime(memorial.submitted_at ?? memorial.updated_at, user.locale);
                    return (
                      <div key={memorial.id} className="rounded-2xl border border-border bg-surface px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-foreground">{memorial.memorial_name ?? memorial.slug}</p>
                              <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted">{getStatusLabel(memorial.status)}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted">/{memorial.slug}</p>
                            <p className="mt-2 text-sm text-muted">
                              {t("approvals.submittedBy", {
                                name: memorial.submitted_by_name ?? t("approvals.unknownSubmitter"),
                                submittedAt: submittedAt ?? t("approvals.unknownDate"),
                              })}
                            </p>
                            <p className="mt-1 text-xs text-muted">{t("approvals.lastUpdated", { updatedAt: formatDateTime(memorial.updated_at, user.locale) ?? t("approvals.unknownDate") })}</p>
                          </div>
                          <Link href={`/memorial/${memorial.slug}/edit`} className="halvaa-btn-secondary inline-flex cursor-pointer px-4 py-2 text-sm">
                            {t("approvals.openMemorial")}
                          </Link>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleReviewMemorial(memorial.id, "APPROVE")}
                            disabled={reviewingMemorialId === memorial.id}
                            className="halvaa-btn-secondary cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {reviewingMemorialId === memorial.id ? t("approvals.processing") : t("approvals.approve")}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReviewMemorial(memorial.id, "FEATURE")}
                            disabled={reviewingMemorialId === memorial.id}
                            className="halvaa-btn-secondary cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {t("approvals.feature")}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReviewMemorial(memorial.id, "REQUEST_CHANGES")}
                            disabled={reviewingMemorialId === memorial.id}
                            className="inline-flex cursor-pointer items-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {t("approvals.requestChanges")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {moderationQueue.length > 0 ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{t("moderation.title")}</h3>
                    <p className="mt-1 text-sm text-muted">{t("moderation.subtitle")}</p>
                  </div>
                  <div className="flex gap-3 text-sm text-muted">
                    <span>{t("moderation.stats.memorials", { count: moderationGroups.length })}</span>
                    <span>{t("moderation.stats.entries", { count: moderationQueue.length })}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {moderationGroups.map((group) => (
                    <div key={group.memorialId} className="rounded-2xl border border-border bg-surface px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{group.memorialName}</p>
                          <p className="mt-1 text-xs text-muted">/{group.memorialSlug} · {t("moderation.groupCount", { count: group.items.length })}</p>
                        </div>
                        <Link href={`/memorial/${group.memorialSlug}/edit`} className="halvaa-btn-secondary inline-flex cursor-pointer px-4 py-2 text-sm">
                          {t("moderation.openMemorial")}
                        </Link>
                      </div>

                      <div className="mt-4 space-y-3">
                        {group.items.map((entry) => (
                          <div key={entry.id} className="rounded-2xl border border-border bg-background px-4 py-4">
                            <p className="text-xs text-muted">{entry.author_name}</p>
                            <p className="mt-1 text-xs text-muted">{t("moderation.submittedAt", { submittedAt: formatDateTime(entry.created_at, user.locale) ?? t("approvals.unknownDate") })}</p>
                            <p className="mt-2 text-sm leading-7 text-foreground/85">{entry.message}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleModerateQueueEntry(entry.memorial_id, entry.id, "APPROVED")}
                                disabled={moderatingId === entry.id}
                                className="halvaa-btn-secondary cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {moderatingId === entry.id ? t("moderation.processing") : t("moderation.approve")}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleModerateQueueEntry(entry.memorial_id, entry.id, "REJECTED")}
                                disabled={moderatingId === entry.id}
                                className="inline-flex cursor-pointer items-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {t("moderation.reject")}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-[2rem] border border-border bg-background p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{t("myMemorials")}</h2>
            <p className="mt-1 text-sm text-muted">{t("myMemorialsHint")}</p>
          </div>
          <Link href="/memorial/create" className="halvaa-btn-primary inline-flex cursor-pointer">
            {tCommon("create_memorial")}
          </Link>
        </div>

        {memorialsLoading ? (
          <p className="mt-6 text-sm text-muted">{t("loading")}</p>
        ) : memorials.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">{t("emptyMemorials")}</div>
        ) : (
          <div className="mt-6 divide-y divide-border">
            {memorials.map((memorial) => (
              <div key={memorial.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-semibold text-foreground">{getName(memorial, user.locale)}</p>
                  <p className="mt-1 text-xs text-muted">/{memorial.slug} · {getStatusLabel(memorial.status)}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/memorial/${memorial.slug}/edit`} className="halvaa-btn-secondary inline-flex cursor-pointer px-4 py-2 text-sm">
                    {t("edit")}
                  </Link>
                  <Link href={`/memorial/${memorial.slug}`} className="halvaa-btn-secondary inline-flex cursor-pointer px-4 py-2 text-sm">
                    {t("view")}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
