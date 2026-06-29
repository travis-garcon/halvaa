"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { HALVAA_BLUR_DATA_URL } from "@/lib/blur";

const STORY_IMAGE = "/assets/img/tree.png";

export function LandingScrollStory() {
  const t = useTranslations("landingStory");
  const paragraphs = [t("paragraphs.0"), t("paragraphs.1"), t("paragraphs.2"), t("paragraphs.3")];

  return (
    <section className="landing-scroll-story" aria-label={t("title")}>
      <div className="landing-scroll-track">
        <div className="landing-scroll-media" aria-hidden="true">
          <Image
            src={STORY_IMAGE}
            alt=""
            fill
            sizes="100vw"
            placeholder="blur"
            blurDataURL={HALVAA_BLUR_DATA_URL}
            className="object-cover"
          />
          <span className="landing-scroll-media-shine" />
        </div>

        <div className="landing-scroll-copy">
          <div className="landing-scroll-heading">
            <p>{t("eyebrow")}</p>
            <h2>{t("title")}</h2>
          </div>
          {paragraphs.map((paragraph, index) => (
            <article key={paragraph} className={index % 2 === 0 ? "landing-story-panel is-left" : "landing-story-panel is-right"}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{paragraph}</p>
            </article>
          ))}
          <div className="landing-scroll-end">
            <Link href="/explore" className="halvaa-btn-primary min-h-12 px-6 text-sm">
              {t("cta")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
