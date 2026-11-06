"use client";

import useSWR from "swr";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api-client";
import type { StoreItemPublic } from "@/lib/api-client";
import { openAuthModal } from "@/lib/auth-modal-events";

type StoreClientProps = { locale: string };

function normalizeStoreSearch(value: string, locale: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase(locale)
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ةۀ]/g, "ه")
    .replace(/[أإٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[\u200c\u200d\u0640]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function formatPrice(item: StoreItemPublic, locale: string) {
  if (locale.startsWith("fa")) return `${new Intl.NumberFormat("fa-IR").format(item.price_irr)} IRR`;
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { style: "currency", currency: "USD" }).format(item.price_usd_cents / 100);
}

function StoreIcon({ kind }: { kind: string }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "VERIFIED_BADGE") return <svg {...common}><circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="none" /><path d="m7.8 12.2 2.7 2.7 5.8-6" stroke="white" strokeWidth="2.2" /></svg>;
  if (kind === "CERAMIC_PLAQUE_SET") return <svg {...common}><rect x="2.5" y="5" width="5.5" height="14" rx="1.2" /><rect x="9.25" y="5" width="5.5" height="14" rx="1.2" /><rect x="16" y="5" width="5.5" height="14" rx="1.2" /><circle cx="5.25" cy="10" r="1.3" /><path d="M4 15h2.5M10.8 8h2.4v2.4h-2.4zM10.8 13.5h2.4v2.4h-2.4zM17.5 9h2.5M17.5 13h2.5M17.5 16h1.5" /></svg>;
  if (kind === "CUSTOM_MEMORIAL_ID") return <svg {...common}><path d="M5 7h14v12H5z" /><path d="M8 11h8M8 15h5" /></svg>;
  if (kind === "FEATURED_PLACEMENT") return <svg {...common}><path d="m12 4 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.3-4.5 2.3.9-5-3.6-3.5 5-.7Z" /></svg>;
  if (kind === "MEMORIAL_PACKAGE") return <svg {...common}><path d="M4 8h16v12H4zM8 8V5h8v3M4 12h16" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v8M8 12h8" /></svg>;
}

export function StoreClient({ locale }: StoreClientProps) {
  const t = useTranslations("store");
  const tAuth = useTranslations("auth");
  const { isAuthenticated } = useAuth();
  const { data: items, isLoading } = useSWR(["store", "items"], () => api.storeItems());
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<StoreItemPublic | null>(null);

  const filteredItems = useMemo(() => {
    const tokens = normalizeStoreSearch(query, locale).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return items ?? [];
    return (items ?? []).filter((item) => {
      const searchableText = normalizeStoreSearch(
        [item.key, item.kind, ...Object.values(item.title), ...Object.values(item.description)].join(" "),
        locale,
      );
      return tokens.every((token) => searchableText.includes(token));
    });
  }, [items, locale, query]);

  return (
    <section className="store-page halvaa-container min-h-[calc(100vh-9rem)] py-5 sm:py-10">
      <div className="store-heading">
        <span className="app-chip">{t("premium_upgrades")}</span>
        <h1>{t("title")}</h1>
        <p>{t("subtitle")}</p>
      </div>
      <label className="store-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
        <input
          id="store-search"
          name="store-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          autoComplete="off"
          dir="auto"
        />
      </label>

      {isLoading ? <div className="store-catalog-grid">{[1, 2, 3, 4].map((item) => <div key={item} className="store-item-skeleton" />)}</div> : filteredItems.length === 0 ? <p className="store-empty">{t("emptySearch")}</p> : (
        <div className="store-catalog-grid">
          {filteredItems.map((item) => {
            const title = item.title[locale] ?? item.title.en ?? item.key;
            return (
              <article key={item.id} className="store-item-card" onClick={() => setSelectedItem(item)}>
                <div className="store-item-icon"><StoreIcon kind={item.kind} /></div>
                <h2>{title}</h2>
                <strong>{formatPrice(item, locale)}</strong>
                <button type="button" className="store-item-details">{t("viewDetails")}</button>
              </article>
            );
          })}
        </div>
      )}

      {selectedItem ? (() => {
        const title = selectedItem.title[locale] ?? selectedItem.title.en ?? selectedItem.key;
        const description = selectedItem.description[locale] ?? selectedItem.description.en ?? "";
        return (
          <div className="store-modal-layer" role="presentation">
            <button type="button" className="store-modal-backdrop" aria-label={t("close")} onClick={() => setSelectedItem(null)} />
            <section className="store-modal" role="dialog" aria-modal="true" aria-labelledby="store-modal-title">
              <button type="button" className="store-modal-close" onClick={() => setSelectedItem(null)} aria-label={t("close")}>×</button>
              <div className="store-item-icon"><StoreIcon kind={selectedItem.kind} /></div>
              <h2 id="store-modal-title">{title}</h2>
              <p>{description}</p>
              <strong className="store-modal-price">{formatPrice(selectedItem, locale)}</strong>
              {!isAuthenticated ? <button type="button" className="halvaa-btn-primary w-full" onClick={() => { setSelectedItem(null); openAuthModal(); }}>{tAuth("sign_in")}</button> : <Link href={`/store/invoice?item=${encodeURIComponent(selectedItem.id)}`} className="halvaa-btn-primary inline-flex w-full justify-center">{t("continueToInvoice")}</Link>}
            </section>
          </div>
        );
      })() : null}
    </section>
  );
}
