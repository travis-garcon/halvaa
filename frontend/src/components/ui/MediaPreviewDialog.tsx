"use client";

import { useEffect, useMemo } from "react";

export const MEDIA_SIZE_LIMITS = {
  image: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  document: 25 * 1024 * 1024,
} as const;

export type PreviewFile = {
  id: string;
  file: File;
  previewUrl: string | null;
  error?: string | null;
};

export function preparePreviewFiles(files: File[], invalidTypeMessage: string, tooLargeMessage: (size: string) => string): PreviewFile[] {
  return files.map((file) => {
    const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type === "application/pdf" ? "document" : null;
    const limit = kind ? MEDIA_SIZE_LIMITS[kind] : 0;
    let error: string | null = null;
    if (!kind) error = invalidTypeMessage;
    else if (file.size > limit) error = tooLargeMessage(formatFileSize(limit));

    return {
      id: crypto.randomUUID(),
      file,
      previewUrl: kind === "image" || kind === "video" ? URL.createObjectURL(file) : null,
      error,
    };
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type MediaPreviewDialogProps = {
  open: boolean;
  files: PreviewFile[];
  title: string;
  hint: string;
  confirmLabel: string;
  cancelLabel: string;
  removeLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  onRemove: (id: string) => void;
};

export function MediaPreviewDialog({
  open,
  files,
  title,
  hint,
  confirmLabel,
  cancelLabel,
  removeLabel,
  onConfirm,
  onClose,
  onRemove,
}: MediaPreviewDialogProps) {
  const hasErrors = useMemo(() => files.some((item) => item.error), [files]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="halvaa-modal-layer" role="presentation">
      <button type="button" className="halvaa-modal-backdrop" aria-label={cancelLabel} onClick={onClose} />
      <div className="halvaa-modal-panel max-w-3xl" role="dialog" aria-modal="true" aria-labelledby="media-preview-title">
        <h2 id="media-preview-title" className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted">{hint}</p>
        <div className="mt-5 grid max-h-[55vh] gap-3 overflow-y-auto sm:grid-cols-2">
          {files.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="flex aspect-video items-center justify-center overflow-hidden bg-background">
                {item.file.type.startsWith("image/") && item.previewUrl ? (
                  <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-contain" />
                ) : item.file.type.startsWith("video/") && item.previewUrl ? (
                  <video src={item.previewUrl} controls playsInline preload="metadata" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-sm font-bold text-muted">PDF</span>
                )}
              </div>
              <div className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.file.name}</p>
                  <p className="mt-1 text-xs text-muted">{formatFileSize(item.file.size)}</p>
                  {item.error ? <p className="mt-2 text-xs font-semibold text-red-600">{item.error}</p> : null}
                </div>
                <button type="button" onClick={() => onRemove(item.id)} className="shrink-0 text-xs font-semibold text-red-600">
                  {removeLabel}
                </button>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="halvaa-btn-secondary cursor-pointer">{cancelLabel}</button>
          <button type="button" onClick={onConfirm} disabled={files.length === 0 || hasErrors} className="halvaa-btn-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

