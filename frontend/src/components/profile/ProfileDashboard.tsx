"use client";

import { ChangeEvent, useEffect, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { useTranslations } from "next-intl";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MediaPreviewDialog, preparePreviewFiles, type PreviewFile } from "@/components/ui/MediaPreviewDialog";
import { notifyApp } from "@/components/ui/AppNotifications";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@/i18n/routing";
import { api, ApiError } from "@/lib/api-client";
import { invalidateExploreAfterMemorialDelete } from "@/lib/explore-cache";
import { openAuthModal } from "@/lib/auth-modal-events";
import type { MemorialStatus } from "@/types/memorial";

type ProfileTab = "memorials" | "plan" | "account";
type MemorialFilter = "all" | "draft" | "published";

function getName(memorial: Awaited<ReturnType<typeof api.myMemorials>>[number], locale: string): string {
  return memorial.translations?.[locale]?.name ?? memorial.translations?.en?.name ?? memorial.slug;
}

function TabIcon({ tab }: { tab: ProfileTab }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (tab === "memorials") return <svg {...common}><path d="M6 20V8l6-4 6 4v12" /><path d="M9 20v-6h6v6" /></svg>;
  if (tab === "plan") return <svg {...common}><path d="M4 7h16v10H4z" /><path d="M4 10h16" /><path d="M8 15h3" /></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="3" /><path d="M6 20a6 6 0 0 1 12 0" /><path d="M19 5v4M17 7h4" /></svg>;
}

export function ProfileDashboard() {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const tStatuses = useTranslations("editMemorial.statuses");
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>("memorials");
  const [profileName, setProfileName] = useState("");
  const [profileLocale, setProfileLocale] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [avatarPreviewFiles, setAvatarPreviewFiles] = useState<PreviewFile[]>([]);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [memorialFilter, setMemorialFilter] = useState<MemorialFilter>("all");
  const [memorialSearch, setMemorialSearch] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; name: string } | null>(null);
  const [deletingMemorial, setDeletingMemorial] = useState(false);
  const [publishingMemorialId, setPublishingMemorialId] = useState<string | null>(null);
  const { data: memorials = [], isLoading: memorialsLoading, mutate: mutateMemorials } = useSWR(
    isAuthenticated ? ["profile", "my-memorials"] : null,
    () => api.myMemorials(),
  );

  useEffect(() => {
    if (!user) return;
    setProfileName(user.full_name);
    setProfileLocale(user.locale);
    setProfileAvatarUrl(user.avatar_url ?? "");
    setProfileEmail(user.email);
    setProfilePhone(user.phone_number ?? "");
    setProfileAddress(user.address ?? "");
  }, [user]);

  if (isLoading) return <div className="profile-empty-state">{t("loading")}</div>;

  if (!isAuthenticated || !user) {
    return (
      <div className="profile-empty-state">
        <h1>{t("signInTitle")}</h1>
        <p>{t("signInBody")}</p>
        <button type="button" onClick={openAuthModal} className="halvaa-btn-primary">{tCommon("sign_in")}</button>
      </div>
    );
  }

  const completion = Math.max(0, Math.min(100, user.profile_completion_percent ?? (user.profile_completed ? 100 : 0)));
  const circumference = 2 * Math.PI * 58;
  const drafts = memorials.filter((item) => item.status === "DRAFT").length;
  const published = memorials.filter((item) => item.status === "PUBLISHED" || item.status === "FEATURED").length;
  const filteredMemorials = memorials.filter((memorial) => {
    const matchesFilter = memorialFilter === "all"
      || (memorialFilter === "draft" && memorial.status === "DRAFT")
      || (memorialFilter === "published" && ["PUBLISHED", "FEATURED"].includes(memorial.status));
    const query = memorialSearch.trim().toLocaleLowerCase(user.locale);
    return matchesFilter && (!query || getName(memorial, user.locale).toLocaleLowerCase(user.locale).includes(query) || memorial.slug.toLowerCase().includes(query));
  });

  const queueAvatar = (files: FileList | null) => {
    if (!files?.length) return;
    setAvatarUploadProgress(0);
    setAvatarPreviewFiles(preparePreviewFiles([files[0]], t("avatarInvalidType"), (size) => t("avatarTooLarge", { size })));
  };

  const closeAvatarPreview = () => {
    avatarPreviewFiles.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    setAvatarPreviewFiles([]);
  };

  const uploadAvatar = async () => {
    const selected = avatarPreviewFiles[0];
    if (!selected) return;
    setSavingProfile(true);
    try {
      const updatedUser = await api.uploadMyAvatar(selected.file, setAvatarUploadProgress);
      await globalMutate(["auth", "me"], updatedUser, { revalidate: false });
      setProfileAvatarUrl(updatedUser.avatar_url ?? "");
      closeAvatarPreview();
      notifyApp({ message: t("avatarSaved"), tone: "success" });
    } catch (error) {
      notifyApp({ message: error instanceof ApiError ? error.message : t("accountSaveError"), tone: "error" });
    } finally {
      setSavingProfile(false);
      setAvatarUploadProgress(0);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const updatedUser = await api.updateMe({
        full_name: profileName.trim(),
        locale: profileLocale || user.locale,
        ...(user.locked_email ? {} : { email: profileEmail.trim() }),
        ...(user.locked_phone_number ? {} : { phone_number: profilePhone.trim() || null }),
        address: profileAddress.trim() || null,
      });
      await globalMutate(["auth", "me"], updatedUser, { revalidate: false });
      setProfileMessage(t("accountSaved"));
    } catch (error) {
      setProfileMessage(error instanceof ApiError ? error.message : t("accountSaveError"));
    } finally {
      setSavingProfile(false);
    }
  };

  const publishDraft = async (memorialId: string) => {
    setPublishingMemorialId(memorialId);
    try {
      await api.updateMemorialStatus(memorialId, "PUBLISHED");
      await mutateMemorials();
      notifyApp({ message: t("publishDraftSuccess"), tone: "success" });
    } catch (error) {
      notifyApp({ message: error instanceof ApiError ? error.message : t("publishDraftError"), tone: "error" });
    } finally {
      setPublishingMemorialId(null);
    }
  };

  const deleteMemorial = async () => {
    if (!deleteCandidate) return;
    setDeletingMemorial(true);
    try {
      await api.deleteMemorial(deleteCandidate.id);
      await mutateMemorials();
      await invalidateExploreAfterMemorialDelete(deleteCandidate.id);
      setDeleteCandidate(null);
      notifyApp({ message: t("deleteSuccess"), tone: "success" });
    } catch (error) {
      notifyApp({ message: error instanceof ApiError ? error.message : t("deleteError"), tone: "error" });
    } finally {
      setDeletingMemorial(false);
    }
  };

  const tabs: Array<{ id: ProfileTab; label: string }> = [
    { id: "memorials", label: t("tabs.memorials") },
    { id: "plan", label: t("tabs.planStore") },
    { id: "account", label: t("tabs.account") },
  ];

  return (
    <div className="profile-workspace">
      <header className="profile-summary">
        <label className="profile-avatar-control" title={t("chooseProfilePhoto")}>
          <svg className="profile-avatar-progress" viewBox="0 0 128 128" aria-label={t("profileCompletionValue", { count: completion })}>
            <circle className="profile-avatar-progress-track" cx="64" cy="64" r="58" />
            <circle
              className={completion === 100 ? "profile-avatar-progress-value is-complete" : "profile-avatar-progress-value"}
              cx="64" cy="64" r="58"
              style={{ strokeDasharray: circumference, strokeDashoffset: circumference * (1 - completion / 100) }}
            />
          </svg>
          <span className="profile-avatar-image">
            {profileAvatarUrl ? <img src={profileAvatarUrl} alt={user.full_name} /> : <span>{user.full_name.trim().charAt(0).toUpperCase() || "H"}</span>}
          </span>
          <span className="profile-avatar-edit" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3" /></svg>
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => queueAvatar(event.target.files)} />
        </label>

        <div className="profile-summary-copy">
          <p className="profile-summary-kicker">{t("title")}</p>
          <h1>{user.full_name}</h1>
          <p>{user.email}</p>
          <div className="profile-completion-line">
            <strong className={completion === 100 ? "is-complete" : ""}>{completion}%</strong>
            <span>{completion === 100 ? t("completionDone") : t("profileCompletion")}</span>
          </div>
        </div>

        <button type="button" className={completion === 100 ? "halvaa-btn-secondary" : "halvaa-btn-primary"} onClick={() => setActiveTab("account")}>
          {completion === 100 ? t("manageAccount") : t("completeProfile")}
        </button>
      </header>

      <nav className="profile-tabs" role="tablist" aria-label={t("tabLabel")}>
        {tabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "is-active" : ""} onClick={() => setActiveTab(tab.id)}>
            <TabIcon tab={tab.id} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <section className="profile-tab-panel" role="tabpanel">
        {activeTab === "memorials" ? (
          <div className="profile-memorials">
            <div className="profile-section-heading">
              <div><h2>{t("myMemorials")}</h2><p>{t("myMemorialsHint")}</p></div>
              <Link href="/memorial/create" className="halvaa-btn-primary inline-flex">{tCommon("create_memorial")}</Link>
            </div>

            <div className="profile-memorial-tools">
              <div className="profile-stat-tabs">
                {([
                  ["all", memorials.length, t("stats.memorials")],
                  ["draft", drafts, t("filterDrafts")],
                  ["published", published, t("published")],
                ] as const).map(([filter, count, label]) => (
                  <button key={filter} type="button" className={memorialFilter === filter ? "is-active" : ""} onClick={() => setMemorialFilter(filter)}>
                    <strong>{count}</strong><span>{label}</span>
                  </button>
                ))}
              </div>
              <label className="profile-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
                <input type="search" value={memorialSearch} onChange={(event) => setMemorialSearch(event.target.value)} placeholder={t("searchMemorials")} />
              </label>
            </div>

            {memorialsLoading ? <p className="profile-list-message">{t("loading")}</p> : filteredMemorials.length === 0 ? <p className="profile-list-message">{t("emptyMemorials")}</p> : (
              <div className="profile-memorial-list">
                {filteredMemorials.map((memorial) => (
                  <article key={memorial.id}>
                    <div className="profile-memorial-main">
                      <span className="profile-memorial-initial">{getName(memorial, user.locale).charAt(0)}</span>
                      <div><h3>{getName(memorial, user.locale)}</h3><p>/{memorial.slug} · {tStatuses(memorial.status as MemorialStatus)}</p></div>
                    </div>
                    <div className="profile-memorial-actions">
                      <Link href={`/memorial/${memorial.slug}/edit`} className="halvaa-btn-secondary inline-flex">{t("edit")}</Link>
                      {memorial.status !== "DRAFT" ? <Link href={`/memorial/${memorial.slug}`} className="halvaa-btn-secondary inline-flex">{t("view")}</Link> : null}
                      {memorial.status === "DRAFT" ? <button type="button" className="halvaa-btn-primary" disabled={publishingMemorialId === memorial.id} onClick={() => void publishDraft(memorial.id)}>{publishingMemorialId === memorial.id ? t("publishingDraft") : t("publishDraft")}</button> : null}
                      <button type="button" className="profile-delete-button" aria-label={t("removeMemorial")} title={t("removeMemorial")} onClick={() => setDeleteCandidate({ id: memorial.id, name: getName(memorial, user.locale) })}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 7h14M9 7V4h6v3M8 10v8M12 10v8M16 10v8M7 7l1 13h8l1-13" /></svg>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "plan" ? (
          <div className="profile-plan">
            <div className="profile-section-heading"><div><h2>{t("packageUsage")}</h2><p>{t("planStoreHint")}</p></div><Link href="/store" className="halvaa-btn-primary inline-flex">{t("openStore")}</Link></div>
            <div className="profile-plan-grid">
              <div><span>{t("packageMemorials")}</span><strong>{user.entitlements.memorials_used} / {user.entitlements.memorial_limit}</strong><small>{t("packageRemaining", { count: user.entitlements.memorials_remaining })}</small></div>
              <div><span>{t("packageCustomIds")}</span><strong>{user.entitlements.custom_ids_used} / {user.entitlements.custom_id_limit}</strong><small>{t("packageRemaining", { count: user.entitlements.custom_ids_remaining })}</small></div>
            </div>
          </div>
        ) : null}

        {activeTab === "account" ? (
          <div className="profile-account">
            <div className="profile-section-heading"><div><h2>{t("accountDetails")}</h2><p>{t("accountDetailsHint")}</p></div></div>
            <div className="profile-account-grid">
              <label><span>{t("fullName")}</span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} /></label>
              <label><span>{t("locale")}</span><select value={profileLocale} onChange={(event) => setProfileLocale(event.target.value)}><option value="en">English</option><option value="fa">فارسی</option><option value="ar">العربية</option><option value="zh">中文</option></select></label>
              <label><span>{t("email")}</span><input type="email" value={profileEmail} disabled={user.locked_email} onChange={(event) => setProfileEmail(event.target.value)} /></label>
              <label><span>{t("phoneNumber")}</span><input value={profilePhone} disabled={user.locked_phone_number} onChange={(event) => setProfilePhone(event.target.value)} /></label>
              <label className="sm:col-span-2"><span>{t("address")}</span><input value={profileAddress} onChange={(event) => setProfileAddress(event.target.value)} autoComplete="street-address" /></label>
            </div>
            {user.missing_profile_fields.length > 0 ? <p className="profile-missing-fields">{t("missingFields", { fields: user.missing_profile_fields.map((field) => t(`fieldNames.${field}`)).join(", ") })}</p> : null}
            <div className="profile-account-actions"><button type="button" className="halvaa-btn-primary" disabled={savingProfile} onClick={() => void saveProfile()}>{savingProfile ? t("savingAccount") : t("saveAccount")}</button>{profileMessage ? <span>{profileMessage}</span> : null}</div>
          </div>
        ) : null}
      </section>

      {avatarUploadProgress > 0 ? <div className="profile-upload-progress"><span style={{ width: `${avatarUploadProgress}%` }} /></div> : null}
      <MediaPreviewDialog open={avatarPreviewFiles.length > 0} files={avatarPreviewFiles} title={t("avatarPreviewTitle")} hint={t("avatarPreviewHint")} confirmLabel={savingProfile ? t("savingAccount") : t("useProfilePhoto")} cancelLabel={tCommon("cancel")} removeLabel={t("removePhoto")} onConfirm={() => void uploadAvatar()} onClose={closeAvatarPreview} onRemove={closeAvatarPreview} />
      <ConfirmDialog open={deleteCandidate !== null} title={t("deleteTitle")} description={t("deleteConfirm", { name: deleteCandidate?.name ?? "" })} confirmLabel={t("removeMemorial")} cancelLabel={tCommon("cancel")} busyLabel={t("deleting")} busy={deletingMemorial} tone="danger" onConfirm={() => void deleteMemorial()} onClose={() => setDeleteCandidate(null)} />
    </div>
  );
}
