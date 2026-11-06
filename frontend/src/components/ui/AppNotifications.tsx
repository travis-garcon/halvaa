"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

export type NotificationTone = "success" | "error" | "warning" | "info";

export type AppNotification = {
  id?: string;
  message: string;
  tone?: NotificationTone;
  durationMs?: number;
};

const NOTIFICATION_EVENT = "halvaa:notify";
const PENDING_NOTIFICATION_KEY = "halvaa:pending-notification";

export function notifyApp(notification: AppNotification) {
  if (typeof window === "undefined") return;
  const normalized = {
    ...notification,
    id: notification.id ?? crypto.randomUUID(),
    tone: notification.tone ?? "info",
  };
  window.sessionStorage.setItem(PENDING_NOTIFICATION_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent<AppNotification>(NOTIFICATION_EVENT, { detail: normalized }));
}

export function AppNotifications() {
  const t = useTranslations("common");
  const [notification, setNotification] = useState<AppNotification | null>(null);
  const timerRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    window.sessionStorage.removeItem(PENDING_NOTIFICATION_KEY);
    setNotification(null);
  }, []);

  const show = useCallback((next: AppNotification) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setNotification(next);
    timerRef.current = window.setTimeout(dismiss, next.durationMs ?? 5200);
  }, [dismiss]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(PENDING_NOTIFICATION_KEY);
    if (raw) {
      try {
        show(JSON.parse(raw) as AppNotification);
      } catch {
        window.sessionStorage.removeItem(PENDING_NOTIFICATION_KEY);
      }
    }

    const handleNotification = (event: Event) => {
      show((event as CustomEvent<AppNotification>).detail);
    };
    window.addEventListener(NOTIFICATION_EVENT, handleNotification);
    return () => {
      window.removeEventListener(NOTIFICATION_EVENT, handleNotification);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [show]);

  if (!notification) return null;

  return (
    <div className={`app-notification app-notification-${notification.tone ?? "info"}`} role={notification.tone === "error" ? "alert" : "status"}>
      <p>{notification.message}</p>
      <button type="button" onClick={dismiss} aria-label={t("close")}>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
