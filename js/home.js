/**
 * Homepage renderer – loads homepage section fixtures and fills mount points.
 * Section fixtures are development-only. Catalogue data uses RamikaContent
 * (see /docs/content-architecture.md). Presentation stays in this file.
 */
(function () {
  const FIXTURE_URL = "/js/data/home-fixtures.json";

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  async function loadHomeSections() {
    if (window.RamikaContent && typeof window.RamikaContent.getHomePageFixtures === "function") {
      const availability = await window.RamikaContent.getFixtureAvailability();
      if (!availability.includeDevelopmentFixtures) {
        return { disabled: true, data: null };
      }
      const data = await window.RamikaContent.getHomePageFixtures();
      return { disabled: false, data };
    }

    const response = await fetch(FIXTURE_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Fixture load failed (${response.status})`);
    return { disabled: false, data: await response.json() };
  }

  const imageBlock = (image, className = "") => {
    if (!image?.src) return "";
    return `<img class="${className}" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || "")}" loading="lazy" decoding="async" width="800" height="600">`;
  };

  function renderHero(data) {
    const root = document.querySelector("[data-home-hero]");
    if (!root || !data) return;

    const img = root.querySelector("[data-hero-image]");
    const video = root.querySelector("[data-hero-video]");
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (img && data.image) {
      img.src = data.image.src;
      img.alt = data.image.alt || "";
      img.removeAttribute("hidden");
    }

    if (video) {
      if (data.image?.src) video.setAttribute("poster", data.image.src);
      const tryPlay = () => {
        const play = video.play();
        if (play && typeof play.catch === "function") play.catch(() => {});
      };

      if (reducedMotion) {
        root.classList.remove("has-video");
        video.removeAttribute("autoplay");
        video.pause();
      } else {
        root.classList.add("has-video");
        video.muted = true;
        video.defaultMuted = true;
        video.setAttribute("playsinline", "");
        if (video.readyState >= 2) tryPlay();
        else video.addEventListener("loadeddata", tryPlay, { once: true });
        video.addEventListener(
          "error",
          () => {
            root.classList.remove("has-video");
            if (img) img.removeAttribute("hidden");
          },
          { once: true }
        );
      }
    }

    const copy = root.querySelector("[data-hero-copy]");
    if (!copy) return;

    copy.innerHTML = `
      ${data.kicker ? `<p class="kicker hero-kicker">${escapeHtml(data.kicker)}</p>` : ""}
      ${data.script ? `<p class="script">${escapeHtml(data.script)}</p>` : ""}
      <h1>${escapeHtml(data.headline || "")}</h1>
      ${data.lede ? `<p class="hero-lede">${escapeHtml(data.lede)}</p>` : ""}
      <div class="hero-actions">
        ${
          data.primaryCta
            ? `<a class="btn-outline hero-cta-primary" href="${escapeHtml(data.primaryCta.href)}">${escapeHtml(data.primaryCta.label)}</a>`
            : ""
        }
        ${
          data.secondaryCta
            ? `<a class="btn-ghost hero-cta-secondary" href="${escapeHtml(data.secondaryCta.href)}">${escapeHtml(data.secondaryCta.label)} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`
            : ""
        }
      </div>
    `;
  }

  function renderIntro(data) {
    const root = document.querySelector("[data-home-intro]");
    if (!root || !data) return;

    const body = (data.body || [])
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");

    const collage = (data.collage || []).slice(0, 4);
    // 2×2 grid order → after rotate(45deg): top, right, left, bottom
    const collageMarkup = collage
      .map(
        (image, index) => `
          <figure class="diamond-tile diamond-tile--${index + 1}">
            ${imageBlock(image)}
          </figure>
        `
      )
      .join("");

    root.innerHTML = `
      <div class="home-intro-copy reveal">
        <header class="section-head section-head--editorial">
          <p class="kicker">${escapeHtml(data.kicker || "")}</p>
          <p class="script">${escapeHtml(data.script || "")}</p>
          <h2>${escapeHtml(data.headline || "")}</h2>
        </header>
        <div class="prose">${body}</div>
        <div class="home-intro-actions">
          ${
            data.primaryCta
              ? `<a class="btn-outline" href="${escapeHtml(data.primaryCta.href)}">${escapeHtml(data.primaryCta.label)}</a>`
              : ""
          }
          ${
            data.secondaryCta
              ? `<a class="btn-ghost" href="${escapeHtml(data.secondaryCta.href)}">${escapeHtml(data.secondaryCta.label)} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`
              : ""
          }
        </div>
      </div>
      <div class="diamond-collage reveal" aria-hidden="${collage.length ? "false" : "true"}">
        <div class="diamond-collage-inner">
          ${collageMarkup}
        </div>
      </div>
    `;
  }

  function normalizeHint(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/^(fixture-|pkg-|dest-)/, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function recordMatchesHint(record, hint) {
    const needles = [hint.id, hint.slug, hint.title, hint.name]
      .map(normalizeHint)
      .filter(Boolean);
    if (!needles.length) return false;
    const hay = normalizeHint(
      [record.id, record.slug, record.name, record.title, record.cardTitle].filter(Boolean).join(" ")
    );
    return needles.some((needle) => hay.includes(needle) || needle.includes(hay));
  }

  function pickFeatured(records, hints, limit) {
    const list = Array.isArray(records) ? records : [];
    const wanted = Array.isArray(hints) ? hints : [];
    const max = Math.max(1, limit || wanted.length || 4);
    const picked = [];
    const used = new Set();

    wanted.forEach((hint) => {
      if (picked.length >= max) return;
      const match = list.find((item) => !used.has(item.id) && recordMatchesHint(item, hint));
      if (!match) return;
      used.add(match.id);
      picked.push(match);
    });

    list.forEach((item) => {
      if (picked.length >= max || used.has(item.id)) return;
      used.add(item.id);
      picked.push(item);
    });

    return picked;
  }

  function sectionHead(section) {
    return `
      <header class="section-head reveal">
        <p class="kicker">${escapeHtml(section.kicker || "")}</p>
        <p class="script">${escapeHtml(section.script || "")}</p>
        <h2>${escapeHtml(section.headline || "")}</h2>
      </header>
      ${section.lede ? `<p class="prose section-lede reveal">${escapeHtml(section.lede)}</p>` : ""}
    `;
  }

  function sectionCta(section) {
    if (!section?.cta) return "";
    return `<p class="section-cta"><a class="btn-ghost" href="${escapeHtml(section.cta.href)}">${escapeHtml(section.cta.label)} <i class="fas fa-arrow-right" aria-hidden="true"></i></a></p>`;
  }

  function carouselShell(trackHtml, label, options = {}) {
    const interval = Number(options.intervalMs) > 0 ? Number(options.intervalMs) : "";
    const extraClass = options.className ? ` ${options.className}` : "";
    return `
      <div class="rail-carousel${extraClass}" data-rail-carousel data-label="${escapeHtml(label || "Carousel")}"${interval ? ` data-rail-interval="${interval}"` : ""}>
        <div class="rail-carousel-toolbar">
          <div class="rail-dots" data-rail-dots role="tablist" aria-label="${escapeHtml(label || "Slides")}"></div>
          <div class="rail-controls">
            <button type="button" class="rail-btn" data-rail-prev aria-label="Previous">
              <i class="fas fa-chevron-left" aria-hidden="true"></i>
            </button>
            <button type="button" class="rail-btn" data-rail-next aria-label="Next">
              <i class="fas fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        <div class="rail-track" data-rail-track tabindex="0">
          ${trackHtml}
        </div>
      </div>
    `;
  }

  function initRailCarousels(scope) {
    const root = scope || document;
    root.querySelectorAll("[data-rail-carousel]").forEach((carousel) => {
      if (carousel.dataset.bound === "1") return;
      carousel.dataset.bound = "1";

      const track = carousel.querySelector("[data-rail-track]");
      const dots = carousel.querySelector("[data-rail-dots]");
      const prev = carousel.querySelector("[data-rail-prev]");
      const next = carousel.querySelector("[data-rail-next]");
      if (!track) return;

      const slides = () => [...track.children];
      let index = 0;
      let timer = null;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const syncDots = () => {
        if (!dots) return;
        const list = slides();
        dots.innerHTML = list
          .map(
            (_, i) =>
              `<button type="button" class="rail-dot${i === index ? " is-active" : ""}" data-rail-dot="${i}" aria-label="Go to slide ${i + 1}" ${i === index ? 'aria-current="true"' : ""}></button>`
          )
          .join("");
      };

      const goTo = (nextIndex, { smooth = true } = {}) => {
        const list = slides();
        if (!list.length) return;
        index = ((nextIndex % list.length) + list.length) % list.length;
        const target = list[index];
        track.scrollTo({
          left: target.offsetLeft - track.offsetLeft,
          behavior: smooth && !reduceMotion ? "smooth" : "auto",
        });
        syncDots();
      };

      const step = (delta) => goTo(index + delta);

      const stopAuto = () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      };

      const intervalMs = Math.max(
        3200,
        Number(carousel.dataset.railInterval) || 4800
      );

      const startAuto = () => {
        stopAuto();
        if (reduceMotion || slides().length < 2) return;
        timer = setInterval(() => step(1), intervalMs);
      };

      prev?.addEventListener("click", () => {
        step(-1);
        startAuto();
      });
      next?.addEventListener("click", () => {
        step(1);
        startAuto();
      });
      dots?.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-rail-dot]");
        if (!btn) return;
        goTo(Number(btn.dataset.railDot));
        startAuto();
      });

      track.addEventListener(
        "scroll",
        () => {
          const list = slides();
          if (!list.length) return;
          const mid = track.scrollLeft + track.clientWidth / 2;
          let closest = 0;
          let best = Infinity;
          list.forEach((slide, i) => {
            const center = slide.offsetLeft - track.offsetLeft + slide.offsetWidth / 2;
            const dist = Math.abs(center - mid);
            if (dist < best) {
              best = dist;
              closest = i;
            }
          });
          if (closest !== index) {
            index = closest;
            syncDots();
          }
        },
        { passive: true }
      );

      // Keep vertical page scroll free; only treat clear horizontal intent as rail motion.
      track.addEventListener(
        "wheel",
        (event) => {
          const absX = Math.abs(event.deltaX);
          const absY = Math.abs(event.deltaY);
          if (absY >= absX) {
            event.preventDefault();
            window.scrollBy({ top: event.deltaY, left: 0, behavior: "auto" });
            return;
          }
          stopAuto();
        },
        { passive: false }
      );

      carousel.addEventListener("mouseenter", stopAuto);
      carousel.addEventListener("mouseleave", startAuto);
      carousel.addEventListener("focusin", stopAuto);
      carousel.addEventListener("focusout", startAuto);

      syncDots();
      goTo(0, { smooth: false });
      startAuto();
    });
  }

  async function catalogueOptions() {
    // Homepage inspirations use published import catalogue only.
    // Local photo-gallery fixtures stay as image fallback inside the content layer.
    return { mode: "published" };
  }

  async function renderSoftNestDestinations(section) {
    const root = document.querySelector("[data-home-destinations]");
    const Content = window.RamikaContent;
    const Cards = window.RamikaCards;
    if (!root || !section || !Content || !Cards) return false;

    const options = await catalogueOptions();
    const preview = Boolean(options.includeFixtures);
    const [destinations, circuits, activities] = await Promise.all([
      Content.getDestinations(options),
      Content.getCircuits(options),
      Content.getActivities(options),
    ]);

    const featured = pickFeatured(destinations, section.items, 10);
    if (!featured.length) return false;

    const circuitsById = Object.fromEntries((circuits || []).map((item) => [item.id, item]));
    const activitiesById = Object.fromEntries((activities || []).map((item) => [item.id, item]));
    const cardsHtml = featured
      .map(
        (item) =>
          `<div class="rail-slide">${Cards.destinationCard(item, {
            circuitsById,
            activitiesById,
            preview,
          })}</div>`
      )
      .join("");

    root.innerHTML = `
      <div class="container-xl">
        ${sectionHead(section)}
        ${carouselShell(cardsHtml, "Destination inspirations")}
        ${sectionCta(section)}
      </div>
    `;
    return true;
  }

  async function renderSoftNestPackages(section) {
    const root = document.querySelector("[data-home-packages]");
    const Content = window.RamikaContent;
    const Cards = window.RamikaCards;
    if (!root || !section || !Content || !Cards) return false;

    const options = await catalogueOptions();
    const preview = Boolean(options.includeFixtures);
    const [packages, destinations, circuits, activities] = await Promise.all([
      Content.getPackages(options),
      Content.getDestinations(options),
      Content.getCircuits(options),
      Content.getActivities(options),
    ]);

    const featured = pickFeatured(packages, section.items, 10);
    if (!featured.length) return false;

    const circuitsById = Object.fromEntries((circuits || []).map((item) => [item.id, item]));
    const destinationsById = Object.fromEntries((destinations || []).map((item) => [item.id, item]));
    const activitiesById = Object.fromEntries((activities || []).map((item) => [item.id, item]));

    const mid = Math.ceil(featured.length / 2);
    const rows = [featured.slice(0, mid), featured.slice(mid)];
    if (!rows[1].length) rows[1] = featured.slice().reverse();

    const rowMarkup = rows
      .map((row, rowIndex) => {
        const cardsHtml = row
          .map(
            (item) =>
              `<div class="rail-slide">${Cards.packageCard(item, {
                circuitsById,
                destinationsById,
                activitiesById,
                preview,
              })}</div>`
          )
          .join("");
        return carouselShell(cardsHtml, `Safari packages row ${rowIndex + 1}`);
      })
      .join("");

    root.innerHTML = `
      <div class="container-xl">
        ${sectionHead(section)}
        <div class="package-rails">
          ${rowMarkup}
        </div>
        ${sectionCta(section)}
      </div>
    `;
    return true;
  }

  function renderExperiences(section) {
    const root = document.querySelector("[data-home-experiences]");
    if (!root || !section) return;

    const items = Array.isArray(section.items) ? section.items : [];
    if (!items.length) {
      root.replaceChildren();
      return;
    }

    const tabs = items
      .map((item, index) => {
        const active = index === 0 ? " is-active" : "";
        return `
          <button type="button" class="exp-tab${active}" data-exp-tab="${escapeHtml(item.id)}" aria-selected="${index === 0 ? "true" : "false"}">
            <span class="exp-tab-icon" aria-hidden="true"><i class="fas ${escapeHtml(item.icon || "fa-compass")}"></i></span>
            <span class="exp-tab-label">${escapeHtml(item.title || "")}</span>
          </button>
        `;
      })
      .join("");

    const panelFor = (item) => {
      const highlights = (item.highlights || [])
        .map(
          (line) =>
            `<li><span class="exp-bullet" aria-hidden="true"><i class="fas fa-star"></i></span><span>${escapeHtml(line)}</span></li>`
        )
        .join("");
      return `
        <div class="exp-panel-copy">
          <h3>${escapeHtml(item.title || "")}</h3>
          ${item.summary ? `<p class="exp-summary">${escapeHtml(item.summary)}</p>` : ""}
          ${highlights ? `<ul class="exp-highlights">${highlights}</ul>` : ""}
        </div>
        <figure class="exp-panel-media">
          ${imageBlock(item.image)}
          <span class="exp-media-mark" aria-hidden="true"><i class="fas fa-location-dot"></i></span>
        </figure>
      `;
    };

    root.innerHTML = `
      <div class="container-xl">
        ${sectionHead(section)}
        <div class="exp-board reveal" data-exp-board>
          <div class="exp-tabs" role="tablist" aria-label="Safari experiences">
            ${tabs}
          </div>
          <div class="exp-dots" data-exp-dots role="tablist" aria-label="Experience slides">
            ${items
              .map(
                (_, i) =>
                  `<button type="button" class="exp-dot${i === 0 ? " is-active" : ""}" data-exp-dot="${i}" aria-label="Show experience ${i + 1}"></button>`
              )
              .join("")}
          </div>
          <div class="exp-panel" data-exp-panel>
            ${panelFor(items[0])}
          </div>
        </div>
      </div>
    `;

    const board = root.querySelector("[data-exp-board]");
    const panel = root.querySelector("[data-exp-panel]");
    const tabButtons = [...root.querySelectorAll("[data-exp-tab]")];
    const dotButtons = [...root.querySelectorAll("[data-exp-dot]")];
    let index = 0;
    let timer = null;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const show = (nextIndex) => {
      index = ((nextIndex % items.length) + items.length) % items.length;
      const item = items[index];
      panel.innerHTML = panelFor(item);
      tabButtons.forEach((btn, i) => {
        const on = i === index;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      dotButtons.forEach((btn, i) => {
        btn.classList.toggle("is-active", i === index);
      });
      // Keep horizontal tab centering inside the tabs strip only –
      // never call scrollIntoView (it can yank the whole page).
      const tabsStrip = root.querySelector(".exp-tabs");
      const activeTab = tabButtons[index];
      if (tabsStrip && activeTab) {
        const left =
          activeTab.offsetLeft - (tabsStrip.clientWidth - activeTab.offsetWidth) / 2;
        tabsStrip.scrollTo({
          left: Math.max(0, left),
          behavior: reduceMotion ? "auto" : "smooth",
        });
      }
    };

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const start = () => {
      stop();
      if (reduceMotion || items.length < 2) return;
      timer = setInterval(() => show(index + 1), 5200);
    };

    tabButtons.forEach((btn, i) => {
      btn.addEventListener("click", () => {
        show(i);
        start();
      });
    });
    dotButtons.forEach((btn, i) => {
      btn.addEventListener("click", () => {
        show(i);
        start();
      });
    });

    board?.addEventListener("mouseenter", stop);
    board?.addEventListener("mouseleave", start);
    start();
  }

  function starsMarkup(rating) {
    const score = Math.min(5, Math.max(1, Number(rating) || 5));
    return `
      <ul class="testimonial-stars" aria-label="${score} out of 5 stars">
        ${Array.from({ length: 5 }, (_, i) =>
          `<li><i class="${i < score ? "fas" : "far"} fa-star" aria-hidden="true"></i></li>`
        ).join("")}
      </ul>
    `;
  }

  function testimonialCard(item) {
    const name = item.name || "Guest";
    const flagCode = String(item.countryCode || "").toLowerCase();
    const flagSrc = flagCode ? `https://flagcdn.com/w40/${escapeHtml(flagCode)}.png` : "";
    const country = item.country || item.place || "";

    return `
      <article class="testimonial-card">
        <div class="testimonial-head">
          <span class="testimonial-avatar" aria-hidden="true">
            <i class="fas fa-user"></i>
          </span>
          <div class="testimonial-person">
            <p class="testimonial-name">${escapeHtml(name)}</p>
            ${
              country
                ? `<p class="testimonial-place">
                    ${
                      flagSrc
                        ? `<img class="testimonial-flag" src="${flagSrc}" alt="" width="20" height="14" loading="lazy" decoding="async">`
                        : ""
                    }
                    <span>${escapeHtml(country)}</span>
                  </p>`
                : ""
            }
          </div>
        </div>
        ${starsMarkup(item.rating)}
        <p class="testimonial-quote">${escapeHtml(item.quote || "")}</p>
      </article>
    `;
  }

  function renderTestimonials(section) {
    const root = document.querySelector("[data-home-testimonials]");
    if (!root || !section) return;

    const items = Array.isArray(section.items) ? section.items : [];
    if (!items.length) {
      root.replaceChildren();
      return;
    }

    const trackHtml = items
      .map((item) => `<div class="rail-slide">${testimonialCard(item)}</div>`)
      .join("");

    root.innerHTML = `
      <div class="container-xl home-testimonials-inner">
        ${sectionHead(section)}
        ${carouselShell(trackHtml, "Guest notes", {
          className: "rail-carousel--testimonials",
          intervalMs: 6200,
        })}
      </div>
    `;
  }

  function renderAbout(data) {
    const root = document.querySelector("[data-home-about]");
    if (!root || !data) return;

    root.innerHTML = `
      <div class="container-xl home-about-grid">
        <figure class="frame home-about-frame">
          ${imageBlock(data.image)}
        </figure>
        <div class="home-about-copy reveal">
          <header class="section-head">
            <p class="kicker">${escapeHtml(data.kicker || "")}</p>
            <p class="script">${escapeHtml(data.script || "")}</p>
            <h2>${escapeHtml(data.headline || "")}</h2>
          </header>
          <p class="prose">${escapeHtml(data.body || "")}</p>
          ${
            data.cta
              ? `<p class="section-cta"><a class="btn-ghost" href="${escapeHtml(data.cta.href)}">${escapeHtml(data.cta.label)} <i class="fas fa-arrow-right" aria-hidden="true"></i></a></p>`
              : ""
          }
        </div>
      </div>
    `;
  }

  function renderEnquire(data) {
    const root = document.querySelector("[data-home-enquire]");
    if (!root || !data) return;

    root.innerHTML = `
      <div class="enquire-band-media" aria-hidden="true">
        ${imageBlock(data.image)}
        <div class="enquire-band-shade"></div>
      </div>
      <div class="container-xl enquire-band-copy reveal">
        <header class="section-head">
          <p class="kicker">${escapeHtml(data.kicker || "")}</p>
          <p class="script">${escapeHtml(data.script || "")}</p>
          <h2>${escapeHtml(data.headline || "")}</h2>
        </header>
        ${data.body ? `<p class="prose">${escapeHtml(data.body)}</p>` : ""}
        ${
          data.cta
            ? `<p class="section-cta"><a class="btn-outline enquire-cta" href="${escapeHtml(data.cta.href)}">${escapeHtml(data.cta.label)}</a></p>`
            : ""
        }
      </div>
    `;
  }

  function observeReveals() {
    if (window.RamikaMotion && typeof window.RamikaMotion.refresh === "function") {
      window.RamikaMotion.refresh();
      // Fixtures mount after first paint – mark anything already in view.
      requestAnimationFrame(() => {
        const viewport = window.innerHeight || 0;
        document.querySelectorAll(".reveal, .media-reveal").forEach((node) => {
          if (node.classList.contains("is-visible")) return;
          const rect = node.getBoundingClientRect();
          if (rect.bottom > 0 && rect.top < viewport * 0.92) {
            node.classList.add("is-visible");
          }
        });
      });
      return;
    }
    document.querySelectorAll(".reveal, .media-reveal").forEach((node) => {
      node.classList.add("is-visible");
    });
  }

  function markFixtures(data) {
    if (data?._meta?.kind !== "development-fixtures") return;
    document.body.dataset.fixtures = "development";
  }

  function showHomeMessage(message) {
    const main = document.querySelector("#content");
    if (!main) return;
    main.insertAdjacentHTML(
      "afterbegin",
      `<p class="fixture-error container-xl" role="alert">${escapeHtml(message)}</p>`
    );
  }

  async function init() {
    if (document.body.dataset.page !== "home") return;

    let payload;
    try {
      payload = await loadHomeSections();
    } catch (error) {
      console.error(error);
      showHomeMessage("Homepage demo content could not be loaded.");
      return;
    }

    if (payload.disabled) {
      document.body.dataset.fixtures = "disabled";
      showHomeMessage(
        "Homepage development fixtures are disabled. Load production section content or re-enable fixtures in content.config.json for local preview."
      );
      return;
    }

    const data = payload.data;
    if (!data) {
      showHomeMessage("Homepage demo content could not be loaded.");
      return;
    }

    markFixtures(data);
    renderHero(data.hero);
    renderIntro(data.intro);
    renderExperiences(data.experiences);

    try {
      const destOk = await renderSoftNestDestinations(data.destinations);
      if (!destOk) {
        document.querySelector("[data-home-destinations]")?.replaceChildren();
      }
    } catch (error) {
      console.error(error);
    }

    try {
      const pkgOk = await renderSoftNestPackages(data.packages);
      if (!pkgOk) {
        document.querySelector("[data-home-packages]")?.replaceChildren();
      }
    } catch (error) {
      console.error(error);
    }

    renderTestimonials(data.testimonials);
    renderAbout(data.about);
    renderEnquire(data.enquire);

    requestAnimationFrame(() => {
      const hero = document.querySelector("[data-home-hero]");
      if (hero) {
        hero.classList.remove("is-ready");
        requestAnimationFrame(() => hero.classList.add("is-ready"));
      }
      initRailCarousels(document);
      observeReveals();
      if (window.RamikaCards && typeof window.RamikaCards.bindCardInteractions === "function") {
        window.RamikaCards.bindCardInteractions(document);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
