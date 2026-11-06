"use client";

import type { ReactNode } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  busyLabel?: string;
  busy?: boolean;
  tone?: "danger" | "primary";
  children?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busyLabel,
  busy = false,
  tone = "primary",
  children,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="halvaa-modal-layer" role="presentation">
      <button type="button" className="halvaa-modal-backdrop" aria-label={cancelLabel} onClick={onClose} />
      <div className="halvaa-modal-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description">
        <h2 id="confirm-dialog-title" className="text-xl font-semibold text-foreground">{title}</h2>
        <p id="confirm-dialog-description" className="mt-3 text-sm leading-7 text-muted">{description}</p>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="halvaa-btn-secondary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={tone === "danger" ? "halvaa-btn-danger cursor-pointer disabled:cursor-not-allowed disabled:opacity-60" : "halvaa-btn-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"}
          >
            {busy ? busyLabel ?? confirmLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

