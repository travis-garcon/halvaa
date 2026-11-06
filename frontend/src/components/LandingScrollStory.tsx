"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

const STORY_IMAGE = "/assets/img/tree.png";

function StoryIcon({ index }: { index: number }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (index === 1) return <svg {...common}><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.25" /><path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M14 15c3.7-.8 5.8.9 6.5 4" /></svg>;
  if (index === 2) return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.4 5.1 3.4 8.5S14.2 18.2 12 20.5C9.8 18.2 8.6 15.4 8.6 12S9.8 5.8 12 3.5Z" /></svg>;
  if (index === 3) return <svg {...common}><path d="M12 3.5 19 6v5.2c0 4.5-2.5 7.5-7 9.3-4.5-1.8-7-4.8-7-9.3V6Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>;
  return <svg {...common}><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22Z" /><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22Z" /></svg>;
}

export function LandingScrollStory() {
  const t = useTranslations("landingStory");
  const stages = useMemo(() => [
    { title: t("eyebrow"), body: t("paragraphs.0") },
    { title: t("title"), body: t("paragraphs.1") },
    { title: t("cta"), body: t("paragraphs.2") },
    { title: t("eyebrow"), body: t("paragraphs.3") },
  ], [t]);

  return (
    <section className="landing-scroll-story" aria-label={t("title")}>
      <div className="landing-scroll-track">
        <div className="landing-scroll-backdrop" style={{ backgroundImage: `url(${STORY_IMAGE})` }} aria-hidden="true" />
        <div className="landing-scroll-copy">
          <div className="landing-scroll-heading"><p>{t("eyebrow")}</p><h2>{t("title")}</h2></div>
          <div className="landing-scroll-paragraphs">
            {stages.map((stage, index) => (
              <article key={`${stage.title}-${index}`} className="landing-story-panel">
                <span className="landing-story-panel-icon" aria-hidden="true"><StoryIcon index={index} /></span>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
