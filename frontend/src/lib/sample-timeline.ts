import type { TimelineEvent } from "@/types/memorial";

const TIMELINE_EN: Record<string, TimelineEvent[]> = {
  "margaret-thompson": [
    {
      id: "1",
      eventType: "BIOGRAPHY",
      title: "A life devoted to literature",
      body: "Margaret dedicated forty years to teaching English and nurturing a love of stories.",
    },
    {
      id: "2",
      eventType: "LIFE_EVENT",
      eventDate: "1965-09-01",
      title: "Began teaching at Cambridge High",
      body: "She joined the faculty and quickly became a beloved mentor.",
    },
    {
      id: "3",
      eventType: "LOCATION",
      eventDate: "2023-08-22",
      title: "Resting place",
      location: "Cambridge, Massachusetts",
    },
  ],
};

const TIMELINE_FA: Record<string, TimelineEvent[]> = {
  ferdowsi: [
    {
      id: "1",
      eventType: "BIOGRAPHY",
      title: "سراینده شاهنامه",
      body: "فردوسی نامدار، حماسه‌سرای ایرانی و خالق شاهنامه.",
    },
    {
      id: "2",
      eventType: "LIFE_EVENT",
      eventDate: "1010-01-01",
      title: "پایان سرایش شاهنامه",
      body: "اثری که قرن‌هاست هویت فرهنگی ایران را روایت می‌کند.",
    },
    {
      id: "3",
      eventType: "LOCATION",
      eventDate: "1020-01-01",
      title: "آرامگاه",
      location: "طوس، خراسان",
    },
  ],
};

export function getSampleTimeline(slug: string, locale: string): TimelineEvent[] {
  const source = locale === "fa" ? TIMELINE_FA : TIMELINE_EN;
  if (source[slug]) {
    return source[slug];
  }

  return [
    {
      id: "bio",
      eventType: "BIOGRAPHY",
      title: locale === "fa" ? "زندگینامه" : "Biography",
      body:
        locale === "fa"
          ? "روایت زندگی به‌زودی در این بخش منتشر می‌شود."
          : "A full biography will appear here soon.",
    },
    {
      id: "event",
      eventType: "LIFE_EVENT",
      eventDate: "1970-01-01",
      title: locale === "fa" ? "رویداد زندگی" : "Life event",
      body:
        locale === "fa"
          ? "خط زمانی با خاطره‌ها و نقاط مهم زندگی تکمیل می‌شود."
          : "The timeline will be enriched with memories and milestones.",
    },
  ];
}
