/**
 * Soft Nest destination + package cards for Ramika Safaris and Tours.
 * Destinations: transparent on-image title (no panel). Packages: nested panel, varied CTAs.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RamikaCards = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const metaLine = (...parts) =>
    parts
      .filter(Boolean)
      .map((part) => `<span>${escapeHtml(part)}</span>`)
      .join('<span class="meta-sep" aria-hidden="true">·</span>');

  const PKG_CTA = [
    { className: "card-cta card-cta--ghost", label: "View itinerary" },
    { className: "card-cta card-cta--pill", label: "See the days" },
    { className: "card-cta card-cta--soft", label: "Open safari" },
    { className: "card-cta card-cta--chip", label: "Plan this route" },
  ];

  const DEST_CTA = [
    { className: "card-cta card-cta--ghost card-cta--on-photo", label: "Explore" },
    { className: "card-cta card-cta--pill card-cta--on-photo", label: "Open park" },
    { className: "card-cta card-cta--soft card-cta--on-photo", label: "Discover" },
    { className: "card-cta card-cta--chip card-cta--on-photo", label: "View place" },
  ];

  function withPreview(href, preview) {
    if (!preview || !href) return href;
    try {
      const url = new URL(href, "http://local.invalid");
      url.searchParams.set("preview", "1");
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return href;
    }
  }

  function pickCta(list, id, overrideLabel) {
    const seed = String(id || "")
      .split("")
      .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const base = list[seed % list.length];
    return {
      className: base.className,
      label: overrideLabel || base.label,
    };
  }

  function imageList(card) {
    if (Array.isArray(card.images) && card.images.length) return card.images.slice(0, 2);
    if (card.image && card.image.src) return [card.image];
    return [];
  }

  function slidesMarkup(images, options) {
    const opts = options || {};
    const eager = Boolean(opts.eager);
    if (!images.length) {
      return `<div class="card-media-fallback" aria-hidden="true"></div>`;
    }
    return `
      <div class="card-slides">
        ${images
          .map((image, index) => {
            const isFirst = index === 0;
            const loading = eager && isFirst ? "eager" : "lazy";
            const priority = eager && isFirst ? ' fetchpriority="high"' : "";
            const decoding = eager && isFirst ? "sync" : "async";
            return `<img class="${isFirst ? "is-active" : ""}" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || "")}" loading="${loading}" decoding="${decoding}"${priority} width="800" height="600">`;
          })
          .join("")}
      </div>
    `;
  }

  function peepMarkup(images) {
    if (images.length < 2) return "";
    const next = images[1];
    return `
      <button class="card-peep" type="button" data-card-next aria-label="Show next photo">
        <img src="${escapeHtml(next.src)}" alt="" aria-hidden="true">
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
    `;
  }

  function likeMarkup(label) {
    return `
      <button class="card-like" type="button" aria-pressed="false" aria-label="Save ${escapeHtml(label)}">
        <i class="far fa-heart" aria-hidden="true"></i>
      </button>
    `;
  }

  function tagsMarkup(tags) {
    const list = Array.isArray(tags) ? tags.filter(Boolean).slice(0, 3) : [];
    if (!list.length) return "";
    return `
      <p class="dest-card-tags">
        ${list
          .map((tag, index) =>
            index === 0
              ? `<span class="dest-card-tag">${escapeHtml(tag)}</span>`
              : `<span class="dest-card-tag-sep" aria-hidden="true">·</span><span class="dest-card-tag">${escapeHtml(tag)}</span>`
          )
          .join("")}
      </p>
    `;
  }

  function packageBulletsMarkup(activityLabels, summary) {
    const all = Array.isArray(activityLabels) ? activityLabels.filter(Boolean) : [];
    const shown = all.slice(0, 2);
    if (!shown.length && summary) {
      shown.push(String(summary).split(/[.!?]/)[0].trim());
    }
    const hiddenCount = Math.max(0, all.length - shown.length);
    if (!shown.length) return "";

    return `
      <ul class="package-card-bullets">
        ${shown.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
      ${
        hiddenCount > 0
          ? `<p class="package-card-more">+${hiddenCount} more on itinerary</p>`
          : ""
      }
    `;
  }

  function destinationCard(destination, options) {
    const Content = typeof window !== "undefined" ? window.RamikaContent : null;
    const opts = options || {};
    const card =
      Content && Content.toDestinationCard
        ? Content.toDestinationCard(destination, {
            circuitsById: opts.circuitsById || {},
            activitiesById: opts.activitiesById || {},
          })
        : null;
    if (!card) return "";

    const href = withPreview(card.href, opts.preview);
    const images = imageList(card);
    const cta = pickCta(DEST_CTA, card.id, opts.actionLabel);
    const title = card.title || card.shortTitle || "";

    return `
      <article class="dest-card dest-card--nest reveal" data-destination-id="${escapeHtml(card.id)}" data-slideshow>
        <div class="dest-card-media media-reveal">
          ${slidesMarkup(images, { eager: opts.eager })}
          <span class="card-wash" aria-hidden="true"></span>
          ${card.touchline ? `<p class="dest-card-touch">${escapeHtml(card.touchline)}</p>` : ""}
          ${likeMarkup(title)}
          ${peepMarkup(images)}
          <div class="dest-card-overlay">
            <h3>${escapeHtml(title)}</h3>
            ${tagsMarkup(card.tags)}
            <a class="${cta.className}" href="${escapeHtml(href)}">${escapeHtml(cta.label)} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>
          </div>
          <a class="card-hit" href="${escapeHtml(href)}" aria-label="${escapeHtml(cta.label)} ${escapeHtml(title)}" tabindex="-1"></a>
        </div>
      </article>
    `;
  }

  function packageCard(pkg, options) {
    const Content = typeof window !== "undefined" ? window.RamikaContent : null;
    const opts = options || {};
    const card =
      Content && Content.toPackageCard
        ? Content.toPackageCard(pkg, {
            circuitsById: opts.circuitsById || {},
            destinationsById: opts.destinationsById || {},
            activitiesById: opts.activitiesById || {},
          })
        : null;
    if (!card) return "";

    const href = withPreview(card.href, opts.preview);
    const images = imageList(card);
    const cta = pickCta(PKG_CTA, card.id, opts.actionLabel);

    return `
      <article class="package-card package-card--nest reveal" data-package-id="${escapeHtml(card.id)}" data-slideshow>
        <div class="package-card-shell">
          <div class="package-card-media media-reveal">
            ${slidesMarkup(images)}
            <span class="card-wash card-wash--soft" aria-hidden="true"></span>
            ${card.duration ? `<span class="package-card-duration">${escapeHtml(card.duration)}</span>` : ""}
            ${likeMarkup(card.title || "package")}
            ${peepMarkup(images)}
          </div>
          <div class="package-card-panel">
            <span class="package-card-mark" aria-hidden="true"></span>
            <h3>${escapeHtml(card.title || "")}</h3>
            ${card.subtitle ? `<p class="package-card-sub">${escapeHtml(card.subtitle)}</p>` : ""}
            ${packageBulletsMarkup(card.activityLabels, card.summary)}
            <div class="package-card-foot">
              ${
                card.priceLabel
                  ? `<p class="package-card-price">${escapeHtml(card.priceLabel)}</p>`
                  : card.duration
                    ? `<p class="package-card-whisper">${escapeHtml(card.duration)}</p>`
                    : ""
              }
              <a class="${cta.className}" href="${escapeHtml(href)}">${escapeHtml(cta.label)} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>
            </div>
          </div>
          <a class="card-hit" href="${escapeHtml(href)}" aria-label="${escapeHtml(cta.label)}: ${escapeHtml(card.title || "")}" tabindex="-1"></a>
        </div>
      </article>
    `;
  }

  function syncPeep(card, index) {
    const slides = [...card.querySelectorAll(".card-slides img")];
    if (slides.length < 2) return;
    const next = slides[(index + 1) % slides.length];
    const peepImg = card.querySelector(".card-peep img");
    if (peepImg && next) peepImg.src = next.currentSrc || next.src;
  }

  function setSlide(card, index) {
    const slides = [...card.querySelectorAll(".card-slides img")];
    if (!slides.length) return;
    const nextIndex = ((index % slides.length) + slides.length) % slides.length;
    slides.forEach((img, i) => img.classList.toggle("is-active", i === nextIndex));
    card.dataset.slideIndex = String(nextIndex);
    syncPeep(card, nextIndex);
  }

  function revealCtas(card) {
    card.querySelectorAll(".card-cta").forEach((cta, index) => {
      window.setTimeout(() => cta.classList.add("is-revealed"), 80 + index * 60);
    });
  }

  function bindCardInteractions(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    scope.querySelectorAll("[data-slideshow]").forEach((card) => {
      if (card.dataset.cardBound === "1") return;
      card.dataset.cardBound = "1";
      setSlide(card, 0);

      const peep = card.querySelector("[data-card-next]");
      if (peep) {
        peep.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setSlide(card, Number(card.dataset.slideIndex || 0) + 1);
        });
      }

      const like = card.querySelector(".card-like");
      if (like) {
        like.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const next = like.getAttribute("aria-pressed") !== "true";
          like.setAttribute("aria-pressed", String(next));
          const icon = like.querySelector("i");
          if (icon) {
            icon.classList.toggle("far", !next);
            icon.classList.toggle("fas", next);
          }
          like.classList.remove("is-pop");
          void like.offsetWidth;
          like.classList.add("is-pop");
        });
      }

      if (reduceMotion) {
        card.querySelectorAll(".card-cta").forEach((cta) => cta.classList.add("is-revealed"));
      } else if (typeof IntersectionObserver !== "undefined") {
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              revealCtas(card);
              io.unobserve(card);
            });
          },
          { threshold: 0.28, rootMargin: "0px 0px -6% 0px" }
        );
        io.observe(card);
      } else {
        revealCtas(card);
      }
    });
  }

  function start() {
    bindCardInteractions(document);
    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver(() => bindCardInteractions(document));
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start);
    } else {
      start();
    }
  }

  return {
    escapeHtml,
    metaLine,
    withPreview,
    destinationCard,
    packageCard,
    bindCardInteractions,
  };
});
