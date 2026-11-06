"use client";

import Image from "next/image";
import type { CSSProperties } from "react";

import { HALVAA_BLUR_DATA_URL, isUploadImageUrl, resolveImageUrl } from "@/lib/blur";

type MemorialImageProps = {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
  fallbackLetter?: string;
};

export function MemorialImage({
  src,
  alt,
  size = 72,
  className = "",
  fallbackLetter,
}: MemorialImageProps) {
  const resolved = resolveImageUrl(src ?? undefined);
  const letter = (fallbackLetter ?? alt.charAt(0)).toUpperCase();
  const circleStyle: CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    maxWidth: size,
    maxHeight: size,
    aspectRatio: "1 / 1",
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
    overflow: "hidden",
  };

  if (!resolved) {
    return (
      <div
        className={[
          "memorial-portrait-image flex items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-lg font-semibold text-primary",
          className,
        ].join(" ")}
        style={circleStyle}
        aria-hidden={!alt}
      >
        {letter}
      </div>
    );
  }

  return (
    <Image
      src={resolved}
      alt={alt}
      width={size}
      height={size}
      placeholder="blur"
      blurDataURL={HALVAA_BLUR_DATA_URL}
      unoptimized={isUploadImageUrl(resolved)}
      className={["memorial-portrait-image rounded-full object-cover", className].join(" ")}
      style={circleStyle}
    />
  );
}
