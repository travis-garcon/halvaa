"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function SmoothScrollEffects() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

    let smoother: ScrollSmoother | undefined;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canSmooth = !reduceMotion && window.innerWidth < 768 && !ScrollSmoother.get();

    if (canSmooth) {
      smoother = ScrollSmoother.create({
        smooth: 0.85,
        effects: true,
        normalizeScroll: false,
      });
    }

    const navs = gsap.utils.toArray<HTMLElement>("header, nav[aria-label]");
    const onScroll = () => {
      gsap.to(navs, {
        autoAlpha: window.scrollY > 24 ? 0.98 : 1,
        y: window.scrollY > 24 ? -1 : 0,
        duration: 0.24,
        ease: "power2.out",
        overwrite: "auto",
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      smoother?.kill();
    };
  }, []);

  return null;
}
