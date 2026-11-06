"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const TREE_POSTER = "/assets/img/tree.png";

function AnimatedAccent({ className = "" }: { className?: string }) {
  return (
    <svg className={`landing-line-accent ${className}`} viewBox="0 0 220 220" aria-hidden="true">
      <path d="M110 18C65 33 37 61 24 104c19-7 40-6 62 4-15 15-23 34-22 58 23-2 42-11 57-26 10 22 11 43 4 62 43-13 71-41 86-86-20 5-40 3-60-8 15-15 24-34 26-57-23 1-42 9-57 24-11-20-13-40-10-57Z" />
    </svg>
  );
}

export function LandingInfoSections() {
  const t = useTranslations("landingInfo");
  const faqs = [0, 1, 2, 3].map((index) => ({
    question: t(`faq.items.${index}.question`),
    answer: t(`faq.items.${index}.answer`),
  }));

  return (
    <section className="landing-info-sections">
      <div className="landing-soft-orbit" aria-hidden="true" />
      <AnimatedAccent className="is-left" />
      <AnimatedAccent className="is-right" />

      <div className="halvaa-container landing-video-band">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="landing-video-copy"
        >
          <p>{t("video.eyebrow")}</p>
          <h2>{t("video.title")}</h2>
          <span>{t("video.body")}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="landing-video-frame"
        >
          <Image src={TREE_POSTER} alt="" fill sizes="(max-width: 900px) 100vw, 52vw" className="object-cover" priority={false} />
          <div className="landing-video-overlay" />
          <button type="button" className="landing-video-play" aria-label={t("video.play")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.6v12.8L18.5 12 8 5.6Z" />
            </svg>
          </button>
        </motion.div>
      </div>

      <div className="halvaa-container landing-faq-band">
        <div className="landing-faq-heading">
          <p>{t("faq.eyebrow")}</p>
          <h2>{t("faq.title")}</h2>
        </div>

        <div className="landing-faq-list">
          {faqs.map((item, index) => (
            <details key={item.question} className="landing-faq-item" open={index === 0}>
              <summary>
                <span>{item.question}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
