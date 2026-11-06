"use client";

import { type CSSProperties, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

type InfoTipProps = {
  label: string;
  children: string;
};

export function InfoTip({ label, children }: InfoTipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    width: number;
    arrowLeft: number;
    placement: "top" | "bottom";
  } | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;

    const edge = 12;
    const gap = 8;
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
    const viewportHeight = viewport?.height ?? document.documentElement.clientHeight;
    const triggerRect = trigger.getBoundingClientRect();
    const width = Math.min(272, Math.max(0, viewportWidth - edge * 2));

    popover.style.width = `${width}px`;
    const popoverHeight = Math.min(popover.scrollHeight, Math.max(0, viewportHeight - edge * 2));
    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    const minLeft = viewportLeft + edge;
    const maxLeft = viewportLeft + viewportWidth - edge - width;
    const left = Math.min(Math.max(triggerCenter - width / 2, minLeft), Math.max(minLeft, maxLeft));
    const minTop = viewportTop + edge;
    const maxTop = viewportTop + viewportHeight - edge - popoverHeight;
    const spaceAbove = triggerRect.top - gap - minTop;
    const spaceBelow = viewportTop + viewportHeight - edge - triggerRect.bottom - gap;
    const placement = spaceAbove >= popoverHeight || spaceAbove >= spaceBelow ? "top" : "bottom";
    const preferredTop = placement === "top"
      ? triggerRect.top - gap - popoverHeight
      : triggerRect.bottom + gap;
    const top = Math.min(Math.max(preferredTop, minTop), Math.max(minTop, maxTop));
    const arrowLeft = Math.min(Math.max(triggerCenter - left, 14), Math.max(14, width - 14));

    setPosition({ left, top, width, arrowLeft, placement });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
  }, [children, open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => updatePosition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
    };
  }, [open, updatePosition]);

  const popoverStyle = position
    ? ({
        left: position.left,
        top: position.top,
        width: position.width,
        "--info-tip-arrow-left": `${position.arrowLeft}px`,
      } as CSSProperties)
    : undefined;

  return (
    <details className="info-tip" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary ref={triggerRef} aria-controls={id} aria-label={label} title={label}>
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.8 9.2a2.35 2.35 0 0 1 4.55.8c0 1.8-2.35 2.05-2.35 3.65" />
          <path d="M12 17.15h.01" />
        </svg>
      </summary>
      <div
        ref={popoverRef}
        id={id}
        role="tooltip"
        className="info-tip-popover"
        data-placement={position?.placement}
        data-positioned={position ? "true" : "false"}
        style={popoverStyle}
      >
        <span className="info-tip-popover-content">{children}</span>
      </div>
    </details>
  );
}

type FieldLabelProps = {
  label: string;
  help?: string;
};

export function FieldLabel({ label, help }: FieldLabelProps) {
  return (
    <span className="mb-1 flex items-center gap-2 font-medium text-foreground">
      <span>{label}</span>
      {help ? <InfoTip label={`${label}: ${help}`}>{help}</InfoTip> : null}
    </span>
  );
}
