/**
 * Individual safari package template – resolves any valid slug from the catalogue.
 * Published by default. Optional ?preview=1 when fixtures are enabled.
 * Never falls back to demo content when a record is missing.
 */
(function () {
  const Content = window.RamikaContent;
  const Cards = window.RamikaCards;

  const els = {
    loading: document.querySelector("[data-pkg-loading]"),
    notFound: document.querySelector("[data-pkg-notfound]"),
    notFoundBody: document.querySelector("[data-pkg-notfound-body]"),
    content: document.querySelector("[data-pkg-content]"),
    hero: document.querySelector("[data-pkg-hero]"),
    heroImage: document.querySelector("[data-pkg-hero-image]"),
    heroCopy: document.querySelector("[data-pkg-hero-copy]"),
    overview: document.querySelector("[data-pkg-overview]"),
    facts: document.querySelector("[data-pkg-facts]"),
    itinerarySection: document.querySelector("[data-pkg-itinerary-section]"),
    itinerary: document.querySelector("[data-pkg-itinerary]"),
    includesSection: document.querySelector("[data-pkg-includes-section]"),
    inclusions: document.querySelector("[data-pkg-inclusions]"),
    exclusions: document.querySelector("[data-pkg-exclusions]"),
    staySection: document.querySelector("[data-pkg-stay-section]"),
    stay: document.querySelector("[data-pkg-stay]"),
    gallerySection: document.querySelector("[data-pkg-gallery-section]"),
    gallery: document.querySelector("[data-pkg-gallery]"),
    destinationsSection: document.querySelector("[data-pkg-destinations-section]"),
    destinations: document.querySelector("[data-pkg-destinations]"),
    relatedSection: document.querySelector("[data-pkg-related-section]"),
    related: document.querySelector("[data-pkg-related]"),
    enquireImage: document.querySelector("[data-pkg-enquire-image]"),
    enquireCopy: document.querySelector("[data-pkg-enquire-copy]"),
    robots: document.querySelector("[data-pkg-robots]"),
  };

  const escapeHtml =
    (Cards && Cards.escapeHtml) ||
    ((value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;"));

  const metaLine =
    (Cards && Cards.metaLine) ||
    ((...parts) =>
      parts
        .filter(Boolean)
        .map((part) => `<span>${escapeHtml(part)}</span>`)
        .join('<span class="meta-sep" aria-hidden="true">·</span>'));

  let preview = false;

  function readQuery() {
    const params = new URLSearchParams(window.location.search);
    return {
      slug: (params.get("slug") || "").trim(),
      preview: params.get("preview") === "1",
    };
  }

  function observeReveals(root) {
    if (window.RamikaMotion) {
      if (typeof window.RamikaMotion.refresh === "function") {
        window.RamikaMotion.refresh();
      } else if (root && typeof window.RamikaMotion.observe === "function") {
        window.RamikaMotion.observe(root);
      }
      return;
    }
    (root || document).querySelectorAll?.(".reveal, .media-reveal").forEach((node) => {
      node.classList.add("is-visible");
    });
  }

  function applySeo(pkg) {
    const title =
      (pkg.seo && pkg.seo.title) || `${pkg.title} · Ramika Safaris and Tours`;
    const description =
      (pkg.seo && pkg.seo.description) ||
      pkg.summary ||
      `Enquire about ${pkg.title} with Ramika Safaris and Tours.`;

    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);

    if (els.robots) {
      if (pkg.isFixture || pkg.status !== "published") {
        els.robots.setAttribute("content", "noindex,nofollow");
      } else {
        els.robots.setAttribute("content", "index,follow");
      }
    }
  }

  function enquireHref(pkg) {
    const params = new URLSearchParams();
    if (pkg.slug) params.set("package", pkg.slug);
    const firstDest = (pkg.destinationIds || [])[0];
    // Destination prefill stays available when the package maps to one place.
    if (firstDest && arguments[1] && arguments[1][firstDest]) {
      params.set("destination", arguments[1][firstDest].slug);
    }
    const query = params.toString();
    return `/contact.html${query ? `?${query}` : ""}#enquire`;
  }

  function showNotFound(message) {
    if (els.loading) els.loading.hidden = true;
    if (els.content) els.content.hidden = true;
    if (els.hero) els.hero.hidden = true;
    if (els.notFound) els.notFound.hidden = false;
    if (els.notFoundBody && message) els.notFoundBody.textContent = message;
    document.title = "Package not found · Ramika Safaris and Tours";
    if (els.robots) els.robots.setAttribute("content", "noindex,nofollow");
    document.body.classList.remove("has-hero");
  }

  function durationLabel(pkg) {
    if (!pkg.duration) return null;
    if (pkg.duration.label) return pkg.duration.label;
    if (Number.isFinite(Number(pkg.duration.days))) {
      const days = Number(pkg.duration.days);
      return `${days} day${days === 1 ? "" : "s"}`;
    }
    return null;
  }

  function priceLabel(pkg) {
    if (!pkg.pricing || pkg.pricing.amount == null || !Number.isFinite(Number(pkg.pricing.amount))) {
      return null;
    }
    const amount = Number(pkg.pricing.amount);
    const currency = pkg.pricing.currency || "USD";
    const formatted = Number.isInteger(amount)
      ? String(amount)
      : amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `${currency} ${formatted}`;
  }

  function renderHero(pkg, circuitsById, destinationsById) {
    if (!els.hero || !els.heroCopy) return;

    const circuitNames = (pkg.circuitIds || [])
      .map((id) => circuitsById[id] && circuitsById[id].name)
      .filter(Boolean);
    const destinationNames = (pkg.destinationIds || [])
      .map((id) => destinationsById[id] && destinationsById[id].name)
      .filter(Boolean);
    const meta = metaLine(durationLabel(pkg), destinationNames[0] || circuitNames[0]);

    if (els.heroImage) {
      if (pkg.heroImage && pkg.heroImage.src) {
        els.heroImage.src = pkg.heroImage.src;
        els.heroImage.alt = pkg.heroImage.alt || "";
        els.heroImage.hidden = false;
      } else {
        els.heroImage.removeAttribute("src");
        els.heroImage.alt = "";
        els.heroImage.hidden = true;
      }
    }

    els.heroCopy.innerHTML = `
      <nav class="crumbs crumbs--on-hero" aria-label="Breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li><a href="/packages.html${preview ? "?preview=1" : ""}">Safari Packages</a></li>
          <li aria-current="page">${escapeHtml(pkg.title)}</li>
        </ol>
      </nav>
      <p class="kicker hero-kicker">Safari package</p>
      <p class="script">${escapeHtml(circuitNames[0] || "Tanzania")}</p>
      <h1>${escapeHtml(pkg.title)}</h1>
      ${meta ? `<p class="hero-meta">${meta}</p>` : ""}
      <div class="hero-actions">
        <a class="btn-outline" href="${escapeHtml(enquireHref(pkg, destinationsById))}">Enquire about this safari</a>
        <a class="btn-ghost" href="#gallery">View gallery <i class="fas fa-arrow-right" aria-hidden="true"></i></a>
      </div>
    `;

    els.hero.classList.remove("is-ready");
    els.hero.hidden = false;
    document.body.classList.add("has-hero");
  }

  function renderOverview(pkg) {
    if (!els.overview) return;
    els.overview.innerHTML = `
      <header class="section-head section-head--start">
        <p class="kicker">Overview</p>
        <p class="script">The journey</p>
        <h2>About this package</h2>
      </header>
      <div class="pkg-detail-prose">
        <p>${escapeHtml(pkg.summary || "Details for this package will appear here once verified copy is published.")}</p>
      </div>
    `;
  }

  function renderFacts(pkg, circuitsById, destinationsById, activitiesById) {
    if (!els.facts) return;

    // Keep the landing facts panel lean — full detail lives further down the page.
    const items = [];
    const duration = durationLabel(pkg);
    if (duration) items.push({ label: "Duration", body: duration });

    const destinations = (pkg.destinationIds || [])
      .map((id) => destinationsById[id] && destinationsById[id].name)
      .filter(Boolean);
    if (destinations.length) {
      const shown = destinations.slice(0, 2);
      const extra = destinations.length - shown.length;
      items.push({
        label: destinations.length > 1 ? "Destinations" : "Destination",
        body: extra > 0 ? `${shown.join(", ")} +${extra} more` : shown.join(", "),
      });
    }

    const activities = (pkg.activityIds || [])
      .map((id) => activitiesById[id] && activitiesById[id].name)
      .filter(Boolean);
    if (activities.length) {
      const shown = activities.slice(0, 2);
      const extra = activities.length - shown.length;
      items.push({
        label: "Experiences",
        body: extra > 0 ? `${shown.join(", ")} +${extra} more` : shown.join(", "),
      });
    }

    const price = priceLabel(pkg);
    if (price) items.push({ label: "From", body: price, price: true });

    if (!items.length) {
      els.facts.hidden = true;
      els.facts.innerHTML = "";
      return;
    }

    els.facts.innerHTML = items
      .map(
        (item) => `
      <div class="pkg-fact">
        <p class="pkg-fact-label">${escapeHtml(item.label)}</p>
        <p class="${item.price ? "pkg-fact-price" : ""}">${escapeHtml(item.body)}</p>
      </div>`
      )
      .join("");
    els.facts.hidden = false;
  }

  function renderItinerary(pkg, destinationsById) {
    if (!els.itinerarySection || !els.itinerary) return;
    const days = Array.isArray(pkg.itinerary) ? pkg.itinerary : [];
    if (!days.length) {
      els.itinerarySection.hidden = true;
      els.itinerary.innerHTML = "";
      return;
    }

    els.itinerarySection.id = "itinerary";
    els.itinerary.innerHTML = days
      .map((day) => {
        const placeNames = (day.destinationIds || [])
          .map((id) => destinationsById[id] && destinationsById[id].name)
          .filter(Boolean);
        return `
        <li class="pkg-day reveal">
          <p class="pkg-day-label">Day ${escapeHtml(day.day)}</p>
          <h3>${escapeHtml(day.title || `Day ${day.day}`)}</h3>
          ${day.summary ? `<p>${escapeHtml(day.summary)}</p>` : ""}
          ${placeNames.length ? `<p class="pkg-day-label">${escapeHtml(placeNames.join(" · "))}</p>` : ""}
        </li>`;
      })
      .join("");
    els.itinerarySection.hidden = false;
  }

  function renderIncludes(pkg) {
    if (!els.includesSection) return;
    const inclusions = Array.isArray(pkg.inclusions) ? pkg.inclusions.filter(Boolean) : [];
    const exclusions = Array.isArray(pkg.exclusions) ? pkg.exclusions.filter(Boolean) : [];

    if (!inclusions.length && !exclusions.length) {
      els.includesSection.hidden = true;
      return;
    }

    if (els.inclusions) {
      if (inclusions.length) {
        els.inclusions.innerHTML = `
          <div class="pkg-include-block reveal">
            <header class="section-head section-head--start">
              <p class="kicker">Included</p>
              <p class="script">With the package</p>
              <h2>Inclusions</h2>
            </header>
            <ul class="pkg-include-list">${inclusions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </div>`;
        els.inclusions.hidden = false;
      } else {
        els.inclusions.innerHTML = "";
        els.inclusions.hidden = true;
      }
    }

    if (els.exclusions) {
      if (exclusions.length) {
        els.exclusions.innerHTML = `
          <div class="pkg-include-block reveal">
            <header class="section-head section-head--start">
              <p class="kicker">Not included</p>
              <p class="script">Paid separately</p>
              <h2>Exclusions</h2>
            </header>
            <ul class="pkg-include-list">${exclusions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
          </div>`;
        els.exclusions.hidden = false;
      } else {
        els.exclusions.innerHTML = "";
        els.exclusions.hidden = true;
      }
    }

    els.includesSection.hidden = false;
  }

  function stayCopy(raw) {
    const text = String(raw || "").trim();
    const dayTrip =
      /day excursion/i.test(text) ||
      /day journey/i.test(text) ||
      /lodging not included/i.test(text) ||
      /overnight lodging is optional/i.test(text);
    const standardOvernight =
      !text ||
      /lodges are not owned by ramika/i.test(text) ||
      /lodging reserved to the standard you name/i.test(text) ||
      /every night is reserved by ramika/i.test(text);

    if (dayTrip) {
      return [
        "This is a day journey — you travel out and return the same day.",
        "Prefer a night nearby before or after the outing? Tell us when you enquire. Ramika will reserve a lodge or campsite to your standard and confirm it before you travel.",
      ];
    }

    if (standardOvernight) {
      return [
        "Every night on this safari is arranged by Ramika to the standard you prefer — from welcoming campsites to carefully chosen lodges along the route.",
        "We book and confirm each stay before you arrive, so you know where you will rest after the day’s road and game drives. Share the comfort level you want when you enquire, and we match lodging that belongs on this journey.",
      ];
    }

    return [text];
  }

  function renderStay(pkg) {
    if (!els.staySection || !els.stay) return;
    const paragraphs = stayCopy(pkg.accommodation);
    if (!paragraphs.length) {
      els.staySection.hidden = true;
      els.stay.innerHTML = "";
      return;
    }
    els.stay.innerHTML = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    els.staySection.hidden = false;
  }

  function renderGallery(pkg) {
    if (!els.gallerySection || !els.gallery) return;
    const images = [];
    const seen = new Set();
    const push = (image) => {
      if (!image || !image.src || seen.has(image.src)) return;
      seen.add(image.src);
      images.push(image);
    };
    (pkg.gallery || []).forEach(push);
    push(pkg.heroImage);

    if (!images.length) {
      els.gallerySection.hidden = true;
      els.gallery.innerHTML = "";
      return;
    }

    els.gallerySection.id = "gallery";

    els.gallery.innerHTML = images
      .map(
        (image) => `
      <figure class="pkg-gallery-item reveal">
        <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || "")}" loading="lazy" decoding="async" width="1200" height="800">
      </figure>`
      )
      .join("");
    els.gallerySection.hidden = false;
  }

  function renderDestinations(destinations, circuitsById, activitiesById) {
    if (!els.destinationsSection || !els.destinations) return;
    if (!destinations.length || !Cards) {
      els.destinationsSection.hidden = true;
      els.destinations.innerHTML = "";
      return;
    }
    els.destinations.innerHTML = destinations
      .map((item) =>
        Cards.destinationCard(item, {
          circuitsById,
          activitiesById: activitiesById || {},
          preview,
        })
      )
      .join("");
    els.destinationsSection.hidden = false;
  }

  function renderRelated(packages, context) {
    if (!els.relatedSection || !els.related) return;
    if (!packages.length || !Cards) {
      els.relatedSection.hidden = true;
      els.related.innerHTML = "";
      return;
    }
    els.related.innerHTML = packages
      .map((item) =>
        Cards.packageCard(item, {
          preview,
          circuitsById: context.circuitsById || {},
          destinationsById: context.destinationsById || {},
          activitiesById: context.activitiesById || {},
        })
      )
      .join("");
    els.relatedSection.hidden = false;
  }

  function renderEnquire(pkg, destinationsById) {
    if (els.enquireImage) {
      if (pkg.heroImage && pkg.heroImage.src) {
        els.enquireImage.src = pkg.heroImage.src;
        els.enquireImage.alt = "";
        els.enquireImage.hidden = false;
      } else {
        els.enquireImage.hidden = true;
      }
    }

    if (!els.enquireCopy) return;
    const cta = pkg.enquireCta || {};
    const href = enquireHref(pkg, destinationsById);
    els.enquireCopy.innerHTML = `
      <header class="section-head">
        <p class="kicker">Next step</p>
        <p class="script">Plan with us</p>
        <h2>${escapeHtml(cta.label || `Enquire about ${pkg.title}`)}</h2>
      </header>
      <p class="prose">Tell us when you can travel and the lodging standard you prefer. This package will be noted on your enquiry – you can change the details on the contact form.</p>
      <p class="section-cta">
        <a class="btn-outline enquire-cta" href="${escapeHtml(href)}">Enquire about this safari</a>
      </p>
    `;
  }

  async function resolveLoadOptions(wantsPreview) {
    if (!wantsPreview) return {};
    const availability = await Content.getFixtureAvailability();
    if (!availability.includeDevelopmentFixtures) return {};
    preview = true;
    document.body.dataset.fixtures = "preview";
    return { mode: "preview", includeFixtures: true };
  }

  function isPublicRecord(pkg) {
    return pkg && pkg.status === "published" && !pkg.isFixture && pkg.contentOrigin === "production";
  }

  async function init() {
    if (document.body.dataset.page !== "package") return;
    if (!Content) {
      showNotFound("Package data could not be loaded.");
      return;
    }

    const query = readQuery();
    if (!query.slug) {
      showNotFound(
        "No package was specified. Choose an itinerary from the packages list, or enquire for a custom safari."
      );
      return;
    }

    try {
      const options = await resolveLoadOptions(query.preview);
      const pkg = await Content.getPackageBySlug(query.slug, options);

      if (!pkg) {
        showNotFound(
          preview
            ? "No package matches this link in the preview catalogue."
            : "This package is not published, or the link may be incorrect."
        );
        return;
      }

      if (!preview && !isPublicRecord(pkg)) {
        showNotFound("This package is not published, or the link may be incorrect.");
        return;
      }

      const [circuits, activities, allPackages, relatedDestinations] = await Promise.all([
        Content.getCircuits(options),
        Content.getActivities(options),
        Content.getPackages(options),
        Content.getRelatedDestinationsForPackage(pkg, options),
      ]);

      const circuitsById = Object.fromEntries((circuits || []).map((item) => [item.id, item]));
      const activitiesById = Object.fromEntries((activities || []).map((item) => [item.id, item]));
      const destinationsById = Object.fromEntries(
        (relatedDestinations || []).map((item) => [item.id, item])
      );

      // Resolve any destination ids referenced by itinerary that were not returned above.
      const neededIds = new Set([
        ...(pkg.destinationIds || []),
        ...((pkg.itinerary || []).flatMap((day) => day.destinationIds || [])),
      ]);
      await Promise.all(
        [...neededIds].map(async (id) => {
          if (destinationsById[id]) return;
          const record = await Content.getDestinationById(id, options);
          if (record) destinationsById[record.id] = record;
        })
      );

      const relatedPackages = (allPackages || [])
        .filter((item) => item.id !== pkg.id)
        .filter((item) => {
          const sharedCircuit = (item.circuitIds || []).some((id) =>
            (pkg.circuitIds || []).includes(id)
          );
          const sharedDestination = (item.destinationIds || []).some((id) =>
            (pkg.destinationIds || []).includes(id)
          );
          return sharedCircuit || sharedDestination;
        })
        .slice(0, 3);

      applySeo(pkg);
      renderHero(pkg, circuitsById, destinationsById);
      renderOverview(pkg);
      renderFacts(pkg, circuitsById, destinationsById, activitiesById);
      renderItinerary(pkg, destinationsById);
      renderIncludes(pkg);
      renderStay(pkg);
      renderGallery(pkg);
      renderDestinations(relatedDestinations || [], circuitsById, activitiesById);
      renderRelated(relatedPackages, { circuitsById, destinationsById, activitiesById });
      renderEnquire(pkg, destinationsById);

      if (els.loading) els.loading.hidden = true;
      if (els.notFound) els.notFound.hidden = true;
      if (els.content) els.content.hidden = false;

      requestAnimationFrame(() => {
        observeReveals(document.querySelector(".pkg-detail-main"));
        observeReveals(els.hero);
      });
    } catch (error) {
      console.error(error);
      showNotFound("Package data could not be loaded.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
