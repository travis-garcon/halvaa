"use client";

import Image from "next/image";

import { HALVAA_BLUR_DATA_URL, resolveImageUrl } from "@/lib/blur";

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

  if (!resolved) {
    return (
      <div
        className={[
          "flex items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-lg font-semibold text-primary",
          className,
        ].join(" ")}
        style={{ width: size, height: size }}
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
      className={["rounded-full object-cover", className].join(" ")}
    />
  );
}
