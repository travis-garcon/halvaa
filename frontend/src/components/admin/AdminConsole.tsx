"use client";

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
  const { user, isLoading: authLoading } = useAuth();
  const canAdmin = !!user && (user.is_superuser || user.role === "ADMIN");
  const { data: kpis, isLoading } = useSWR(canAdmin ? ["admin", "kpis"] : null, () => api.adminKpis());

  if (authLoading) {
    return <section className="halvaa-container py-10 text-sm text-muted">Loading...</section>;
  }

  if (!canAdmin) {
    return (
      <section className="halvaa-container py-10 ltr:text-left rtl:text-right">
        <div className="rounded-2xl border border-border bg-background p-6 text-sm text-muted shadow-soft">
          Admin role required.
        </div>
      </section>
    );
  }

  const cards = [
    { label: "Users", value: kpis?.users ?? 0, icon: "US" },
    { label: "Memorials", value: kpis?.memorials ?? 0, icon: "KP" },
    { label: "Guestbook", value: kpis?.guestbook_entries ?? 0, icon: "CM" },
    { label: "Income", value: `${formatMoney(kpis?.income_usd_cents ?? 0, "USD", locale)} / ${formatMoney(kpis?.income_irr ?? 0, "IRR", locale)}`, icon: "$" },
  ];

  return (
    <section className="halvaa-container min-h-[calc(100vh-9rem)] space-y-6 py-5 sm:py-10 ltr:text-left rtl:text-right">
      <div className="app-card rounded-[2rem] p-5 sm:p-8">
        <span className="app-chip">Admin</span>
        <h1 className="mt-4 text-4xl font-black leading-tight text-foreground sm:text-6xl">Console</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
          Review growth, income, and the memorials selected for the public landing experience.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-[1.75rem] border border-border bg-white p-5 shadow-[0_14px_42px_rgba(17,17,17,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted">{card.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{card.icon}</span>
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground">{isLoading ? "..." : card.value}</p>
          </article>
        ))}
      </div>

      <div className="rounded-[1.75rem] border border-border bg-white p-5 shadow-[0_14px_42px_rgba(17,17,17,0.06)]">
        <h2 className="text-lg font-semibold text-foreground">Landing placements</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Choose memorials for the home page showcase and keep the public story fresh.
        </p>
      </div>
    </section>
  );
}
