"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState, useEffect } from "react";

import { MemorialImage } from "@/components/ui/MemorialImage";
import { Link } from "@/i18n/routing";
import type { GridMemorial } from "@/types/memorial";

const CELL = 92;
const GAP = 18;

type GridPosition = {
  memorial: GridMemorial;
  x: number;
  y: number;
};

type ExploreWatchGridProps = {
  memorials: GridMemorial[];
};

function buildHoneycombPositions(memorials: GridMemorial[]): GridPosition[] {
  const columns = Math.ceil(Math.sqrt(memorials.length * 1.2));
  return memorials.map((memorial, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const offsetX = row % 2 === 0 ? 0 : (CELL + GAP) / 2;
    return {
      memorial,
      x: col * (CELL + GAP) + offsetX,
      y: row * (CELL + GAP * 0.86),
    };
  });
}

type WatchGridBubbleProps = {
  position: GridPosition;
  offsetX: ReturnType<typeof useMotionValue<number>>;
  offsetY: ReturnType<typeof useMotionValue<number>>;
  containerWidth: number;
  containerHeight: number;
};

function WatchGridBubble({
  position,
  offsetX,
  offsetY,
  containerWidth,
  containerHeight,
}: WatchGridBubbleProps) {
  const scale = useTransform([offsetX, offsetY], ([latestX, latestY]) => {
    const x = latestX as number;
    const y = latestY as number;
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    const itemCenterX = position.x + CELL / 2 + x;
    const itemCenterY = position.y + CELL / 2 + y;
    const distance = Math.hypot(itemCenterX - centerX, itemCenterY - centerY);
    return Math.max(0.62, Math.min(1.18, 1.22 - distance / 280));
  });

  const zIndex = useTransform(scale, (value) => Math.round(value * 100));

  return (
    <motion.div
      style={{
        x: position.x,
        y: position.y,
        scale,
        zIndex,
        width: CELL,
        height: CELL,
      }}
      className="absolute"
      whileTap={{ scale: 0.94 }}
    >
      <Link
        href={`/memorial/${position.memorial.slug}`}
        className="group flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
      >
        <div className="overflow-hidden rounded-full border-2 border-white shadow-soft transition group-hover:border-primary">
          <MemorialImage
            src={position.memorial.imageUrl}
            alt={position.memorial.name}
            size={72}
            fallbackLetter={position.memorial.name.charAt(0)}
          />
        </div>
        <span className="max-w-[88px] truncate text-center text-[11px] font-medium text-foreground">
          {position.memorial.name}
        </span>
      </Link>
    </motion.div>
  );
}

export function ExploreWatchGrid({ memorials }: ExploreWatchGridProps) {
  const t = useTranslations("explore");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(360);
  const containerHeight = Math.min(containerWidth * 1.17, 500);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        if (parent) {
          const width = Math.min(parent.clientWidth - 4, 480);
          setContainerWidth(Math.max(width, 280));
        }
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const positions = useMemo(() => buildHoneycombPositions(memorials), [memorials]);

  const gridWidth = useMemo(() => {
    if (memorials.length === 0) return 0;
    const maxX = Math.max(...positions.map((item) => item.x), 0);
    return maxX + CELL + GAP;
  }, [memorials.length, positions]);

  const gridHeight = useMemo(() => {
    if (memorials.length === 0) return 0;
    const maxY = Math.max(...positions.map((item) => item.y), 0);
    return maxY + CELL + GAP;
  }, [memorials.length, positions]);

  const offsetX = useMotionValue(Math.max((containerWidth - gridWidth) / 2, 8));
  const offsetY = useMotionValue(Math.max((containerHeight - gridHeight) / 2, 8));

  if (memorials.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-[2rem] border border-border px-6 text-center text-sm text-muted">
        {t("emptyGrid")}
      </div>
    );
  }

  return (
    <div className="page-entrance w-full ltr:text-left rtl:text-right">
      <p className="mb-4 text-sm text-muted">{t("gridHint")}</p>
      <div
        ref={containerRef}
        className="relative mx-auto overflow-hidden rounded-[2rem] border border-border bg-gradient-to-b from-background to-primary/5"
        style={{ height: containerHeight, maxWidth: containerWidth }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,107,0,0.08),transparent_65%)]"
        />
        <motion.div
          drag
          dragMomentum={false}
          dragElastic={0.08}
          dragConstraints={containerRef}
          style={{
            width: gridWidth,
            height: gridHeight,
            x: offsetX,
            y: offsetY,
            touchAction: "none",
          }}
          className="absolute cursor-grab active:cursor-grabbing"
        >
          {positions.map((position) => (
            <WatchGridBubble
              key={position.memorial.id}
              position={position}
              offsetX={offsetX}
              offsetY={offsetY}
              containerWidth={containerWidth}
              containerHeight={containerHeight}
            />
          ))}
        </motion.div>
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        {t("gridCount", { count: memorials.length })}
      </p>
    </div>
  );
}
