/**
 * Shared motion: IntersectionObserver reveals + optional gentle parallax.
 * No scroll hijacking. Respects prefers-reduced-motion.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RamikaMotion = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const REDUCE = "(prefers-reduced-motion: reduce)";
  const REVEAL_SELECTOR = ".reveal, .media-reveal";
  const MEDIA_AUTO_SELECTOR = [
    ".frame",
    ".dest-card-media",
    ".package-card-media",
    ".media-card-media",
    ".circuit-card-media",
    ".experience-tile-media",
    ".dest-gallery-item",
    ".pkg-gallery-item",
    ".dest-intro-frame",
    ".pkg-intro-frame",
    ".dest-detail-intro-frame",
    ".home-intro-frame",
    ".home-about-frame",
    ".about-intro-frame",
    ".about-why-frame",
    ".about-close-frame",
    ".about-moment-frame",
    ".moments-cell",
    ".gallery-tile",
    ".director-card-media",
  ].join(", ");

  const HERO_SELECTOR = [
    ".home-hero",
    ".about-hero",
    ".page-hero.dest-hero",
    ".page-hero.pkg-hero",
    ".page-hero.dest-detail-hero",
    ".page-hero.pkg-detail-hero",
    ".page-hero",
  ].join(", ");

  let observer = null;
  let mutationObserver = null;
  let parallaxNodes = [];
  let parallaxRaf = 0;
  let parallaxBound = false;
  let started = false;

  function reducedMotion() {
    return window.matchMedia(REDUCE).matches;
  }

  function markVisible(node) {
    if (!node || node.classList.contains("is-visible")) return;
    node.classList.add("is-visible");
  }

  function ensureObserver() {
    if (observer || reducedMotion()) return observer;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          markVisible(entry.target);
          observer.unobserve(entry.target);
        });
      },
      {
        root: null,
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.12,
      }
    );

    return observer;
  }

  function prepareMedia(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(MEDIA_AUTO_SELECTOR).forEach((node) => {
      if (node.classList.contains("media-reveal")) return;
      // Keep section/copy rise and image clip as separate treatments.
      if (node.classList.contains("reveal")) return;
      if (!node.querySelector("img")) return;
      node.classList.add("media-reveal");
    });
  }

  function observe(root) {
    const scope = root && root.querySelectorAll ? root : document;

    if (reducedMotion()) {
      scope.querySelectorAll(REVEAL_SELECTOR).forEach(markVisible);
      return;
    }

    prepareMedia(scope);
    const io = ensureObserver();
    if (!io) {
      scope.querySelectorAll(REVEAL_SELECTOR).forEach(markVisible);
      return;
    }

    scope.querySelectorAll(REVEAL_SELECTOR).forEach((node) => {
      if (node.classList.contains("is-visible")) return;
      io.observe(node);
    });
  }

  function readyHeroes() {
    document.querySelectorAll(HERO_SELECTOR).forEach((hero) => {
      if (hero.classList.contains("is-ready")) return;
      // Wait until the hero is shown and populated (detail/home fixtures).
      if (hero.hidden || hero.hasAttribute("hidden")) return;
      if (hero.querySelector(".hero-loading")) return;
      requestAnimationFrame(() => {
        if (hero.hidden || hero.hasAttribute("hidden")) return;
        hero.classList.add("is-ready");
      });
    });
  }

  function bindParallax() {
    if (reducedMotion() || parallaxBound) return;
    if (window.matchMedia("(max-width: 767px)").matches) return;

    const heroes = document.querySelectorAll(
      ".home-hero > img, .about-hero > img, .page-hero > img, .dest-hero > img, .pkg-hero > img, .dest-detail-hero > img, .pkg-detail-hero > img"
    );

    parallaxNodes = [...heroes].filter((img) => img && !img.hidden);
    if (!parallaxNodes.length) return;

    parallaxNodes.forEach((img) => {
      if (!img.hasAttribute("data-parallax")) img.setAttribute("data-parallax", "hero");
      // Avoid fighting entrance transitions once parallax takes over.
      img.style.transition = "none";
    });

    const tick = () => {
      parallaxRaf = 0;
      const viewport = window.innerHeight || 1;
      parallaxNodes.forEach((img) => {
        const hero = img.parentElement;
        if (!hero || hero.classList.contains("is-ready") === false) return;
        const rect = hero.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > viewport) return;
        // Very gentle shift – storytelling, not distraction.
        const progress = (viewport / 2 - (rect.top + rect.height / 2)) / viewport;
        const offset = Math.max(-16, Math.min(16, progress * 22));
        img.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0) scale(1)`;
      });
    };

    const onScroll = () => {
      if (parallaxRaf) return;
      parallaxRaf = requestAnimationFrame(tick);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    parallaxBound = true;
    onScroll();
  }

  function watchDom() {
    if (mutationObserver || typeof MutationObserver === "undefined") return;

    mutationObserver = new MutationObserver((mutations) => {
      let needsObserve = false;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (
            node.matches?.(REVEAL_SELECTOR) ||
            node.matches?.(MEDIA_AUTO_SELECTOR) ||
            node.querySelector?.(REVEAL_SELECTOR) ||
            node.querySelector?.(MEDIA_AUTO_SELECTOR)
          ) {
            needsObserve = true;
          }
        });
      });
      if (needsObserve) observe(document);
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  function refresh() {
    readyHeroes();
    observe(document);
    bindParallax();
  }

  function markInViewVisible() {
    const viewport = window.innerHeight || 0;
    document.querySelectorAll(REVEAL_SELECTOR).forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < viewport * 0.92) {
        markVisible(node);
      }
    });
  }

  function start() {
    if (started) return;
    started = true;

    if (reducedMotion()) {
      document.documentElement.classList.add("motion-reduced");
      document.querySelectorAll(REVEAL_SELECTOR).forEach(markVisible);
      document.querySelectorAll(HERO_SELECTOR).forEach((hero) => hero.classList.add("is-ready"));
      return;
    }

    prepareMedia(document);
    // Reveal above-the-fold nodes before enabling hidden state to avoid a blank first paint.
    markInViewVisible();
    document.documentElement.classList.add("motion-ready");
    refresh();
    watchDom();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  return {
    observe,
    refresh,
    start,
    reducedMotion,
  };
});
