"use client";

import { motion, useMotionValue, useMotionValueEvent } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { MemorialImage } from "@/components/ui/MemorialImage";
import { MemorialBadge } from "@/components/ui/MemorialBadge";
import { Link } from "@/i18n/routing";
import type { GridMemorial } from "@/types/memorial";

const BUBBLE_MEDIA_SIZE = 112;
const CELL = 148;
const GAP = 24;
const REPEAT_COLUMNS = 3;
const REPEAT_ROWS = 3;

type GridPosition = {
  memorial: GridMemorial;
  x: number;
  y: number;
};

type GridLayout = {
  positions: GridPosition[];
  tileWidth: number;
  tileHeight: number;
};

type ExploreWatchGridProps = {
  memorials: GridMemorial[];
};

function fillVisibleMemorials(memorials: GridMemorial[], minimumCount: number): GridMemorial[] {
  if (memorials.length === 0 || memorials.length >= minimumCount) {
    return memorials;
  }
  return Array.from({ length: minimumCount }, (_, index) => memorials[index % memorials.length]);
}

function buildHoneycombLayout(memorials: GridMemorial[], minimumCount: number): GridLayout {
  const filledMemorials = fillVisibleMemorials(memorials, minimumCount);
  const columns = Math.max(3, Math.ceil(Math.sqrt(filledMemorials.length * 1.15)));
  const basePositions = filledMemorials.map((memorial, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const offsetX = row % 2 === 0 ? 0 : (CELL + GAP) / 2;
    return {
      memorial,
      x: col * (CELL + GAP) + offsetX,
      y: row * (CELL * 0.9 + GAP),
    };
  });
  const baseWidth = Math.max(...basePositions.map((item) => item.x), 0) + CELL + GAP * 3;
  const baseHeight = Math.max(...basePositions.map((item) => item.y), 0) + CELL + GAP * 4;

  return {
    positions: Array.from({ length: REPEAT_COLUMNS * REPEAT_ROWS }).flatMap((_, repeatIndex) => {
      const repeatCol = repeatIndex % REPEAT_COLUMNS;
      const repeatRow = Math.floor(repeatIndex / REPEAT_COLUMNS);
      return basePositions.map((position) => ({
        memorial: position.memorial,
        x: position.x + repeatCol * baseWidth,
        y: position.y + repeatRow * baseHeight,
      }));
    }),
    tileWidth: baseWidth,
    tileHeight: baseHeight,
  };
}

function wrappedOffset(value: number, origin: number, span: number): number {
  if (!span) return value;
  if (value > origin + span) return value - span;
  if (value < origin - span) return value + span;
  return value;
}

type WatchGridBubbleProps = {
  position: GridPosition;
};

function WatchGridBubble({ position }: WatchGridBubbleProps) {
  return (
    <div
      style={{
        left: position.x,
        top: position.y,
        width: CELL,
        height: CELL,
      }}
      className="absolute"
    >
      <Link
        href={`/memorial/${position.memorial.slug}`}
        className="explore-watch-bubble group flex h-full w-full cursor-pointer flex-col items-center justify-start gap-2 rounded-full px-2 pt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
      >
        <div className="explore-watch-bubble-media relative overflow-hidden rounded-full border border-white/50">
          <MemorialImage
            src={position.memorial.imageUrl}
            alt={position.memorial.name}
            size={BUBBLE_MEDIA_SIZE}
            fallbackLetter={position.memorial.name.charAt(0)}
            className="rounded-full"
          />
          <MemorialBadge
            status={position.memorial.status}
            isVerified={position.memorial.isVerified}
            viewCount={position.memorial.viewCount}
            className="absolute bottom-1 end-1"
          />
        </div>
        <span className="max-w-[104px] truncate text-center text-[11px] font-black tracking-[0.02em] text-white">
          {position.memorial.name}
        </span>
      </Link>
    </div>
  );
}

export function ExploreWatchGrid({ memorials }: ExploreWatchGridProps) {
  const t = useTranslations("explore");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(360);
  const containerHeight = Math.max(560, Math.min(containerWidth * 1.7, 860));

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        if (parent) {
          const width = parent.clientWidth;
          setContainerWidth(Math.max(width, 300));
        }
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const minimumVisualCells = useMemo(() => {
    const columns = Math.ceil(containerWidth / (CELL + GAP));
    const rows = Math.ceil(containerHeight / (CELL * 0.9 + GAP));
    return Math.max(memorials.length, columns * rows + columns * 2);
  }, [containerHeight, containerWidth, memorials.length]);
  const layout = useMemo(() => buildHoneycombLayout(memorials, minimumVisualCells), [memorials, minimumVisualCells]);
  const positions = layout.positions;

  const gridWidth = useMemo(() => {
    if (memorials.length === 0) return 0;
    const maxX = Math.max(...positions.map((item) => item.x), 0);
    return maxX + CELL + GAP * 2;
  }, [memorials.length, positions]);

  const gridHeight = useMemo(() => {
    if (memorials.length === 0) return 0;
    const maxY = Math.max(...positions.map((item) => item.y), 0);
    return maxY + CELL + GAP * 3;
  }, [memorials.length, positions]);

  const offsetX = useMotionValue((containerWidth - gridWidth) / 2);
  const offsetY = useMotionValue((containerHeight - gridHeight) / 2);
  const originX = (containerWidth - gridWidth) / 2;
  const originY = (containerHeight - gridHeight) / 2;

  useEffect(() => {
    offsetX.set(originX);
    offsetY.set(originY);
  }, [offsetX, offsetY, originX, originY]);

  useMotionValueEvent(offsetX, "change", (latest) => {
    const next = wrappedOffset(latest, originX, layout.tileWidth);
    if (next !== latest) offsetX.set(next);
  });

  useMotionValueEvent(offsetY, "change", (latest) => {
    const next = wrappedOffset(latest, originY, layout.tileHeight);
    if (next !== latest) offsetY.set(next);
  });

  if (memorials.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/68">
        {t("emptyGrid")}
      </div>
    );
  }

  return (
    <div className="explore-watch-grid-shell page-entrance w-full text-left" dir="ltr">
      <div ref={containerRef} className="explore-watch-grid-canvas relative h-full w-full overflow-hidden">
        <div aria-hidden className="explore-watch-grid-glow" />
        <motion.div
          drag
          dragMomentum
          dragElastic={0.22}
          dragTransition={{ power: 0.22, timeConstant: 650, modifyTarget: (target) => target }}
          style={{
            width: gridWidth,
            height: gridHeight,
            x: offsetX,
            y: offsetY,
            touchAction: "none",
          }}
          className="absolute cursor-grab active:cursor-grabbing"
        >
          {positions.map((position, index) => (
            <WatchGridBubble
              key={`${position.memorial.id}-${index}`}
              position={position}
            />
          ))}
        </motion.div>
      </div>
      <p className="explore-watch-grid-count">{t("gridCount", { count: memorials.length })}</p>
    </div>
  );
}
