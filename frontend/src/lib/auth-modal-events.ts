"use client";

export const OPEN_AUTH_MODAL_EVENT = "halvaa:open-auth-modal";

export function openAuthModal() {
  window.dispatchEvent(new Event(OPEN_AUTH_MODAL_EVENT));
}
