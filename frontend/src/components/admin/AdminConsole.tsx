"use client";

import { useTranslations } from "next-intl";
import useSWR from "swr";

import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";

type AdminConsoleProps = {
  locale: string;
};

function formatMoney(value: number, currency: "USD" | "IRR", locale: string) {
  if (currency === "USD") {
    return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { style: "currency", currency }).format(value / 100);
  }
  return new Intl.NumberFormat(locale.startsWith("fa") ? "fa-IR" : locale).format(value) + " IRR";
}

export function AdminConsole({ locale }: AdminConsoleProps) {
  const t = useTranslations("admin");
  const { user, isLoading: authLoading } = useAuth();
  const canAdmin = !!user && (user.is_superuser || user.role === "ADMIN");
  const { data: kpis, isLoading } = useSWR(canAdmin ? ["admin", "kpis"] : null, () => api.adminKpis());
  const { data: placements, isLoading: placementsLoading } = useSWR(canAdmin ? ["admin", "landing-placements", locale] : null, () => api.adminLandingPlacements(locale));

  if (authLoading) {
    return <section className="halvaa-container py-10 text-sm text-muted">{t("loading")}</section>;
  }

  if (!canAdmin) {
    return (
      <section className="halvaa-container py-10 ltr:text-left rtl:text-right">
        <div className="rounded-2xl border border-border bg-background p-6 text-sm text-muted shadow-soft">
          {t("required")}
        </div>
      </section>
    );
  }

  const cards = [
    { label: t("users"), value: kpis?.users ?? 0, icon: "US" },
    { label: t("memorials"), value: kpis?.memorials ?? 0, icon: "KP" },
    { label: t("published"), value: kpis?.published_memorials ?? 0, icon: "PB" },
    { label: t("guestbook"), value: kpis?.guestbook_entries ?? 0, icon: "CM" },
  ];
  const publishedRate = kpis?.memorials ? Math.round((kpis.published_memorials / kpis.memorials) * 100) : 0;

  return (
    <section className="halvaa-container min-h-[calc(100vh-9rem)] space-y-6 py-24 sm:py-28 ltr:text-left rtl:text-right">
      <div className="rounded-[1.5rem] border border-border bg-white p-5 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="app-chip">{t("admin")}</span>
            <h1 className="mt-4 text-4xl font-black leading-tight text-foreground sm:text-6xl">{t("console")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
              {t("summary")}
            </p>
          </div>
          <div className="grid min-w-64 gap-2 rounded-[1rem] border border-border bg-surface p-4">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-muted">{t("publishedRatio")}</span>
            <strong className="text-3xl font-black text-foreground">{isLoading ? "..." : `${publishedRate}%`}</strong>
            <span className="h-2 overflow-hidden rounded-full bg-border">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${publishedRate}%` }} />
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-[1.25rem] border border-border bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted">{card.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{card.icon}</span>
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground">{isLoading ? "..." : card.value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[1.25rem] border border-border bg-white p-5">
          <p className="text-sm font-medium text-muted">{t("income")}</p>
          <p className="mt-4 text-2xl font-black text-foreground">{formatMoney(kpis?.income_usd_cents ?? 0, "USD", locale)}</p>
          <p className="mt-1 text-lg font-bold text-muted">{formatMoney(kpis?.income_irr ?? 0, "IRR", locale)}</p>
          <p className="mt-4 text-sm leading-6 text-muted">{t("incomeHint")}</p>
        </article>

        <article className="rounded-[1.25rem] border border-border bg-white p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-foreground">{t("placements")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{t("placementsHint")}</p>
            </div>
            <span className="text-sm font-bold text-primary">{placementsLoading ? "..." : t("activeRows", { count: placements?.length ?? 0 })}</span>
          </div>
          <div className="mt-5 divide-y divide-border rounded-[1rem] border border-border">
            {placementsLoading ? (
              <p className="p-4 text-sm text-muted">{t("loadingPlacements")}</p>
            ) : placements && placements.length > 0 ? (
              placements.map((placement) => (
                <div key={placement.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-foreground">{placement.memorial_name ?? placement.memorial_slug}</p>
                    <p className="mt-1 text-xs text-muted">{placement.category} · {t("order", { order: placement.sort_order })} · {placement.is_active ? t("active") : t("inactive")}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">{placement.label ?? t("noLabel")}</span>
                </div>
              ))
            ) : (
              <p className="p-4 text-sm text-muted">{t("emptyPlacements")}</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
