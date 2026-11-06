"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR from "swr";

import { useAuth } from "@/hooks/use-auth";
import { Link } from "@/i18n/routing";
import { api, ApiError, type CheckoutResponse } from "@/lib/api-client";
import { openAuthModal } from "@/lib/auth-modal-events";

type Provider = "STRIPE" | "ZARINPAL" | "CRYPTO";

function formatAmount(amount: number, currency: string, locale: string) {
  if (currency === "IRR") return `${new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(amount)} IRR`;
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { style: "currency", currency: "USD" }).format(amount / 100);
}

export function StoreInvoiceClient({ locale }: { locale: string }) {
  const t = useTranslations("store");
  const params = useSearchParams();
  const itemId = params.get("item");
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: items, isLoading: itemsLoading } = useSWR(["store", "items"], () => api.storeItems());
  const { data: memorials = [] } = useSWR(isAuthenticated ? ["profile", "my-memorials"] : null, () => api.myMemorials());
  const item = useMemo(() => items?.find((candidate) => candidate.id === itemId), [itemId, items]);
  const [provider, setProvider] = useState<Provider>(locale === "fa" ? "ZARINPAL" : "STRIPE");
  const [memorialId, setMemorialId] = useState("");
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading || itemsLoading) return <div className="store-invoice-state">{t("invoice.loading")}</div>;
  if (!itemId || !item) return <div className="store-invoice-state"><p>{t("invoice.notFound")}</p><Link href="/store" className="halvaa-btn-secondary inline-flex">{t("invoice.backStore")}</Link></div>;
  if (!isAuthenticated) return <div className="store-invoice-state"><p>{t("invoice.signIn")}</p><button type="button" className="halvaa-btn-primary" onClick={openAuthModal}>{t("invoice.signInAction")}</button></div>;

  const assignToMemorial = item.item_metadata.assignable_to === "memorial";
  const title = item.title[locale] ?? item.title.en ?? item.key;
  const description = item.description[locale] ?? item.description.en ?? "";
  const amount = provider === "ZARINPAL" ? item.price_irr : item.price_usd_cents;
  const currency = provider === "ZARINPAL" ? "IRR" : "USD";
  const profileComplete = Boolean(user?.profile_completed && user.profile_completion_percent === 100);

  const beginCheckout = async () => {
    if (assignToMemorial && !memorialId) {
      setError(t("invoice.chooseMemorialError"));
      return;
    }
    if (!profileComplete) {
      setError(t("invoice.profileIncomplete"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.createCheckout({ store_item_id: item.id, memorial_id: assignToMemorial ? memorialId : null, locale, provider });
      setCheckout(result);
      if (!result.test_mode && result.checkout_url) window.location.href = result.checkout_url;
    } catch (checkoutError) {
      setError(checkoutError instanceof ApiError && checkoutError.status === 503 ? t("invoice.gatewayUnavailable") : checkoutError instanceof ApiError && checkoutError.status === 403 && checkoutError.message === "PROFILE_INCOMPLETE" ? t("invoice.profileIncomplete") : checkoutError instanceof ApiError ? checkoutError.message : t("invoice.checkoutError"));
    } finally {
      setBusy(false);
    }
  };

  const completeTestCheckout = async () => {
    if (!checkout) return;
    setBusy(true);
    try {
      await api.completeCheckoutForDevelopment(checkout.purchase_id);
      window.location.href = `/${locale}/profile`;
    } catch (checkoutError) {
      setError(checkoutError instanceof ApiError ? checkoutError.message : t("invoice.checkoutError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="store-invoice-page">
      <div className="store-invoice-heading"><p>{t("invoice.eyebrow")}</p><h1>{t("invoice.title")}</h1></div>
      <div className="store-invoice-layout">
        <div className="store-invoice-form">
          <div><span>{t("invoice.item")}</span><h2>{title}</h2><p>{description}</p></div>
          {assignToMemorial ? (
            <label><span>{t("invoice.assignMemorial")}</span><select value={memorialId} onChange={(event) => setMemorialId(event.target.value)}><option value="">{t("invoice.chooseMemorial")}</option>{memorials.map((memorial) => <option key={memorial.id} value={memorial.id}>{memorial.translations?.[locale]?.name ?? memorial.translations?.en?.name ?? memorial.slug}</option>)}</select></label>
          ) : <p className="store-invoice-account-note">{t("invoice.assignedAccount")}</p>}
          <fieldset><legend>{t("invoice.paymentMethod")}</legend><div className="store-provider-options">{(["STRIPE", "ZARINPAL", "CRYPTO"] as Provider[]).map((option) => <label key={option} className={provider === option ? "is-active" : ""}><input type="radio" name="provider" value={option} checked={provider === option} onChange={() => setProvider(option)} /><strong>{t(`invoice.providers.${option}.title`)}</strong><small>{t(`invoice.providers.${option}.hint`)}</small></label>)}</div></fieldset>
        </div>
        <aside className="store-invoice-summary">
          <h2>{t("invoice.summary")}</h2>
          <div><span>{t("invoice.product")}</span><strong>{title}</strong></div>
          <div><span>{t("invoice.gateway")}</span><strong>{t(`invoice.providers.${provider}.title`)}</strong></div>
          <div className="is-total"><span>{t("invoice.total")}</span><strong>{formatAmount(amount, currency, locale)}</strong></div>
          {!profileComplete ? <p className="store-invoice-error">{t("invoice.profileIncomplete")} <Link href="/profile">{t("invoice.completeProfile")}</Link></p> : null}
          {error ? <p className="store-invoice-error">{error}</p> : null}
          {checkout?.test_mode ? <button type="button" className="halvaa-btn-primary w-full" disabled={busy || !profileComplete} onClick={() => void completeTestCheckout()}>{t("complete_test_checkout")}</button> : <button type="button" className="halvaa-btn-primary w-full" disabled={busy || !profileComplete} onClick={() => void beginCheckout()}>{busy ? t("invoice.processing") : t("invoice.pay")}</button>}
          <Link href="/store" className="store-invoice-back">{t("invoice.backStore")}</Link>
        </aside>
      </div>
    </section>
  );
}
