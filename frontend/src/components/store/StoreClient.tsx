"use client";

import useSWR from "swr";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { api, type CheckoutResponse } from "@/lib/api-client";

type StoreClientProps = {
  locale: string;
};

function formatPrice(item: { price_usd_cents: number; price_irr: number }, locale: string) {
  if (locale.startsWith("fa")) {
    return new Intl.NumberFormat("fa-IR").format(item.price_irr) + " IRR";
  }
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { style: "currency", currency: "USD" }).format(item.price_usd_cents / 100);
}

export function StoreClient({ locale }: StoreClientProps) {
  const t = useTranslations("store");
  const tAuth = useTranslations("auth");
  const { isAuthenticated } = useAuth();
  const { data: items, isLoading } = useSWR(["store", "items"], () => api.storeItems());
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buy = async (storeItemId: string) => {
    setError(null);
    setCheckout(null);
    if (!isAuthenticated) {
      setError(tAuth("sign_in"));
      return;
    }
    setBusyId(storeItemId);
    try {
      const response = await api.createCheckout({ store_item_id: storeItemId, locale });
      setCheckout(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("coming_soon_body"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="halvaa-container min-h-[calc(100vh-9rem)] py-5 sm:py-10">
      <div className="app-card mb-6 rounded-[2rem] p-5 sm:p-8 ltr:text-left rtl:text-right">
        <span className="app-chip">{t("premium_upgrades")}</span>
        <h1 className="mt-4 text-4xl font-black leading-tight text-foreground sm:text-6xl">{t("title")}</h1>
        <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">{t("subtitle")}</p>
      </div>

      {checkout && (
        <div className="mb-5 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm text-foreground ltr:text-left rtl:text-right">
          {checkout.provider} · {checkout.currency} {checkout.amount} · {checkout.checkout_url}
        </div>
      )}
      {error && <div className="mb-5 rounded-2xl border border-border bg-background p-4 text-sm text-muted">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        {(items ?? []).map((item, index) => {
          const title = item.title[locale] ?? item.title.en ?? item.key;
          const description = item.description[locale] ?? item.description.en ?? "";
          const icon = item.kind === "CUSTOM_MEMORIAL_ID" ? "ID" : index === 0 ? "OK" : "+";
          return (
            <article key={item.id} className="rounded-[2rem] border border-border bg-white p-5 shadow-[0_14px_42px_rgba(17,17,17,0.06)] transition hover:-translate-y-1 hover:border-primary/40">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <span className="text-sm font-bold">{icon}</span>
                </div>
                <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">{formatPrice(item, locale)}</span>
              </div>
              <h2 className="mt-5 text-xl font-semibold text-foreground">{title}</h2>
              <p className="mt-2 min-h-14 text-sm leading-6 text-muted">{description}</p>
              <button
                type="button"
                onClick={() => void buy(item.id)}
                disabled={busyId === item.id}
                className="mt-5 w-full halvaa-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyId === item.id ? t("coming_soon_title") : t("buy_now")}
              </button>
            </article>
          );
        })}
        {isLoading &&
          Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-2xl border border-border bg-surface" />
          ))}
      </div>
    </section>
  );
}
