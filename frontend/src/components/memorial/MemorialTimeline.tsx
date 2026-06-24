"use client";

import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

import type { TimelineEvent, TimelineEventType } from "@/types/memorial";

type MemorialTimelineProps = {
  events: TimelineEvent[];
};

const eventTypeStyles: Record<TimelineEventType, string> = {
  BIOGRAPHY: "bg-primary/10 text-primary border border-primary/10",
  LIFE_EVENT: "bg-[#f7f1e8] text-foreground border border-[#eadfce]",
  LOCATION: "bg-[#201a16] text-white border border-[#201a16]",
};

function formatEventDate(date: string | undefined, locale: string): string | null {
  if (!date) {
    return null;
  }
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function MemorialTimeline({ events }: MemorialTimelineProps) {
  const t = useTranslations("timeline");
  const locale = useLocale();
  const isRtl = locale === "fa";

  if (!events.length) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
        {t("empty")}
      </p>
    );
  }

  const sorted = [...events].sort((a, b) => {
    if (!a.eventDate && !b.eventDate) return 0;
    if (!a.eventDate) return 1;
    if (!b.eventDate) return -1;
    return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
  });

  return (
    <div className="relative mx-auto max-w-4xl py-4">
      <div
        aria-hidden
        className={[
          "absolute top-0 bottom-0 w-px bg-border/70",
          isRtl ? "right-4 md:right-1/2 md:translate-x-1/2" : "left-4 md:left-1/2 md:-translate-x-1/2",
        ].join(" ")}
      />

      <ol className="space-y-10">
        {sorted.map((event, index) => {
          const formattedDate = formatEventDate(event.eventDate, locale);
          const alignRight = isRtl ? index % 2 === 0 : index % 2 !== 0;

          return (
            <motion.li
              key={event.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: index * 0.05 }}
              className={[
                "relative grid grid-cols-1 md:grid-cols-2 md:gap-10",
                alignRight
                  ? "md:[&>article]:col-start-2"
                  : "md:[&>article]:col-start-1",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-6 z-10 h-4 w-4 rounded-full border-[3px] border-background bg-primary shadow-soft",
                  isRtl
                    ? "right-4 md:right-1/2 md:translate-x-1/2"
                    : "left-4 md:left-1/2 md:-translate-x-1/2",
                ].join(" ")}
              />

              <article
                className={[
                  "rounded-[2rem] border border-border/80 bg-background/95 p-6 shadow-soft backdrop-blur-sm sm:p-7",
                  isRtl ? "mr-10 text-right md:mr-0" : "ml-10 text-left md:ml-0",
                  "md:text-start",
                ].join(" ")}
              >
                <div
                  className={[
                    "mb-4 flex flex-wrap items-center gap-2.5",
                    isRtl ? "justify-end md:justify-start" : "justify-start",
                  ].join(" ")}
                >
                  <span
                      className={[
                        "rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em]",
                        eventTypeStyles[event.eventType],
                      ].join(" ")}
                    >
                    {t(`types.${event.eventType}`)}
                  </span>
                  {formattedDate && (
                    <time className="text-xs font-medium text-muted" dateTime={event.eventDate}>
                      {formattedDate}
                    </time>
                  )}
                </div>

                <h3 className="text-xl font-semibold text-foreground sm:text-2xl">{event.title}</h3>
                {event.thumbnailUrl && (
                  <img
                    src={event.thumbnailUrl}
                    alt={event.title}
                    className="mt-4 h-44 w-full rounded-[1.4rem] border border-border/70 object-cover"
                    loading="lazy"
                  />
                )}
                {event.body && (
                  <p className="mt-3 text-sm leading-8 text-foreground/80 sm:text-base">{event.body}</p>
                )}
                {event.location && (
                  <p className="mt-4 text-sm font-medium text-primary">{event.location}</p>
                )}
              </article>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
