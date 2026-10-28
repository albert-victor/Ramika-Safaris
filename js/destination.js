/**
 * Individual destination template – resolves any valid slug from the catalogue.
 * Page flow: slim hero → gallery → details + CTAs → packages → nearby → shared footer.
 * Published by default. Optional ?preview=1 when fixtures are enabled in config.
 * Never falls back to demo content when a record is missing.
 */
(function () {
  const Content = window.RamikaContent;
  const Cards = window.RamikaCards;

  const els = {
    loading: document.querySelector("[data-dest-loading]"),
    notFound: document.querySelector("[data-dest-notfound]"),
    notFoundBody: document.querySelector("[data-dest-notfound-body]"),
    content: document.querySelector("[data-dest-content]"),
    hero: document.querySelector("[data-dest-hero]"),
    heroImage: document.querySelector("[data-dest-hero-image]"),
    heroCopy: document.querySelector("[data-dest-hero-copy]"),
    intro: document.querySelector("[data-dest-intro]"),
    highlightsSection: document.querySelector("[data-dest-highlights-section]"),
    highlights: document.querySelector("[data-dest-highlights]"),
    gallerySection: document.querySelector("[data-dest-gallery-section]"),
    gallery: document.querySelector("[data-dest-gallery]"),
    practicalSection: document.querySelector("[data-dest-practical-section]"),
    practical: document.querySelector("[data-dest-practical]"),
    ctas: document.querySelector("[data-dest-ctas]"),
    packagesSection: document.querySelector("[data-dest-packages-section]"),
    packages: document.querySelector("[data-dest-packages]"),
    relatedSection: document.querySelector("[data-dest-related-section]"),
    related: document.querySelector("[data-dest-related]"),
    relatedTitle: document.querySelector("[data-dest-related-title]"),
    robots: document.querySelector("[data-dest-robots]"),
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

  function splitProse(text) {
    const raw = String(text || "").trim();
    if (!raw) return [];
    const blocks = raw
      .split(/\n\s*\n/)
      .map((block) => block.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);
    if (blocks.length > 1) return blocks;

    const sentences = raw.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [raw];
    if (sentences.length < 3) return [raw];
    const paragraphs = [];
    let bucket = "";
    sentences.forEach((sentence, index) => {
      const next = `${bucket}${sentence}`.trim();
      if (next.length > 280 && bucket) {
        paragraphs.push(bucket.trim());
        bucket = sentence;
      } else {
        bucket = `${bucket}${sentence}`;
      }
      if (index === sentences.length - 1 && bucket.trim()) paragraphs.push(bucket.trim());
    });
    return paragraphs.length ? paragraphs : [raw];
  }

  /** Hero lede: one short line only. */
  function oneLineLede(text, maxLen) {
    const limit = maxLen || 118;
    const flat = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!flat) return "";
    if (flat.length <= limit) return flat;
    const cut = flat.slice(0, limit - 1).replace(/\s+\S*$/, "");
    return `${cut || flat.slice(0, limit - 1)}…`;
  }

  function applySeo(destination) {
    const title =
      (destination.seo && destination.seo.title) ||
      `${destination.name} · Ramika Safaris and Tours`;
    const description =
      (destination.seo && destination.seo.description) ||
      destination.intro ||
      `Explore ${destination.name} with Ramika Safaris and Tours.`;

    document.title = title;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);

    if (els.robots) {
      if (destination.isFixture || destination.status !== "published") {
        els.robots.setAttribute("content", "noindex,nofollow");
      } else {
        els.robots.setAttribute("content", "index,follow");
      }
    }
  }

  function enquireHref(destination) {
    const params = new URLSearchParams();
    if (destination.slug) params.set("destination", destination.slug);
    const query = params.toString();
    return `/contact.html${query ? `?${query}` : ""}#enquire`;
  }

  function showNotFound(message) {
    if (els.loading) els.loading.hidden = true;
    if (els.content) els.content.hidden = true;
    if (els.hero) els.hero.hidden = true;
    if (els.notFound) els.notFound.hidden = false;
    if (els.notFoundBody && message) els.notFoundBody.textContent = message;
    document.title = "Destination not found · Ramika Safaris and Tours";
    if (els.robots) els.robots.setAttribute("content", "noindex,nofollow");
    document.body.classList.remove("has-hero");
  }

  function renderHero(destination, circuitsById) {
    if (!els.hero || !els.heroCopy) return;

    const circuitNames = (destination.circuitIds || [])
      .map((id) => circuitsById[id] && circuitsById[id].name)
      .filter(Boolean);
    const subtitle = circuitNames[0] || destination.region || "Tanzania";
    const lede = oneLineLede(destination.intro || destination.description);

    if (els.heroImage) {
      if (destination.heroImage && destination.heroImage.src) {
        els.heroImage.src = destination.heroImage.src;
        els.heroImage.alt = destination.heroImage.alt || "";
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
          <li><a href="/destinations.html${preview ? "?preview=1" : ""}">Destinations</a></li>
          <li aria-current="page">${escapeHtml(destination.name)}</li>
        </ol>
      </nav>
      <p class="script">${escapeHtml(subtitle)}</p>
      <h1>${escapeHtml(destination.name)}</h1>
      ${lede ? `<p class="hero-lede">${escapeHtml(lede)}</p>` : ""}
    `;

    els.hero.classList.remove("is-ready");
    els.hero.hidden = false;
    document.body.classList.add("has-hero");
  }

  function renderOverview(destination) {
    if (!els.intro) return;

    const paragraphs = splitProse(destination.description || destination.intro);
    els.intro.innerHTML = `
      <header class="section-head section-head--start">
        <p class="kicker">Overview</p>
        <p class="script">The place itself</p>
        <h2>About ${escapeHtml(destination.name)}</h2>
      </header>
      <div class="dest-detail-prose">
        ${
          paragraphs.length
            ? paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")
            : `<p>Details for this destination will appear here once verified copy is published.</p>`
        }
      </div>
    `;
  }

  function renderHighlights(destination, activitiesById) {
    if (!els.highlightsSection || !els.highlights) return;

    const blocks = [];
    const wildlife = (destination.wildlifeHighlights || []).filter(Boolean);
    if (wildlife.length) {
      blocks.push(`
        <article class="dest-highlight reveal">
          <p class="dest-highlight-label">Wildlife</p>
          <h3>Wildlife highlights</h3>
          <ul class="dest-highlight-list">
            ${wildlife.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
      `);
    }

    const activities = (destination.activityIds || [])
      .map((id) => activitiesById[id])
      .filter(Boolean);
    activities.forEach((activity) => {
      blocks.push(`
        <article class="dest-highlight reveal">
          <p class="dest-highlight-label">${escapeHtml(activity.category || "Experience")}</p>
          <h3>${escapeHtml(activity.name)}</h3>
          ${activity.summary ? `<p>${escapeHtml(activity.summary)}</p>` : ""}
        </article>
      `);
    });

    if (!blocks.length) {
      els.highlightsSection.hidden = true;
      els.highlights.innerHTML = "";
      return;
    }

    els.highlights.innerHTML = blocks.join("");
    els.highlightsSection.hidden = false;
  }

  function renderGallery(destination) {
    if (!els.gallerySection || !els.gallery) return;

    const images = [];
    const seen = new Set();
    const push = (image) => {
      if (!image || !image.src || seen.has(image.src)) return;
      seen.add(image.src);
      images.push(image);
    };

    (destination.gallery || []).forEach(push);
    push(destination.heroImage);

    if (!images.length) {
      els.gallerySection.hidden = true;
      els.gallery.innerHTML = "";
      return;
    }

    els.gallery.innerHTML = images
      .map(
        (image) => `
      <figure class="dest-gallery-item reveal">
        <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || "")}" loading="lazy" decoding="async" width="1200" height="800">
        ${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ""}
      </figure>`
      )
      .join("");
    els.gallerySection.hidden = false;
  }

  function renderPractical(destination, circuitsById) {
    if (!els.practicalSection || !els.practical) return;

    const items = [];
    const circuitNames = (destination.circuitIds || [])
      .map((id) => circuitsById[id] && circuitsById[id].name)
      .filter(Boolean);

    if (destination.region) {
      items.push({ title: "Location", body: destination.region });
    }
    if (circuitNames.length) {
      items.push({
        title: circuitNames.length > 1 ? "Safari circuits" : "Safari circuit",
        body: circuitNames.join(", "),
      });
    }
    if (destination.bestTimeToVisit) {
      items.push({ title: "Best time to visit", body: destination.bestTimeToVisit });
    }

    if (!items.length) {
      els.practicalSection.hidden = true;
      els.practical.innerHTML = "";
      return;
    }

    els.practical.innerHTML = items
      .map(
        (item) => `
      <article class="dest-practical-item reveal">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
      </article>`
      )
      .join("");
    els.practicalSection.hidden = false;
  }

  function renderCtas(destination, hasPackages) {
    if (!els.ctas) return;
    const packagesHref = hasPackages
      ? "#related-packages"
      : preview
        ? `/packages.html?preview=1`
        : `/packages.html`;

    els.ctas.innerHTML = `
      <p class="dest-detail-ctas-label">Plan this journey</p>
      <div class="dest-detail-ctas-row">
        <a class="btn-outline" href="${escapeHtml(enquireHref(destination))}">Plan your safari</a>
        <a class="btn-ghost" href="${escapeHtml(packagesHref)}">${
          hasPackages ? "Explore safari packages" : "View safari packages"
        } <i class="fas fa-arrow-right" aria-hidden="true"></i></a>
        <a class="btn-ghost" href="${escapeHtml(enquireHref(destination))}">Enquire about ${escapeHtml(
          destination.name
        )}</a>
      </div>
    `;
  }

  function renderPackages(packages, context) {
    if (!els.packagesSection || !els.packages) return;
    if (!packages.length || !Cards) {
      els.packagesSection.hidden = true;
      els.packages.innerHTML = "";
      return;
    }

    els.packages.innerHTML = packages
      .map((pkg) =>
        Cards.packageCard(pkg, {
          preview,
          circuitsById: (context && context.circuitsById) || {},
          destinationsById: (context && context.destinationsById) || {},
          activitiesById: (context && context.activitiesById) || {},
        })
      )
      .join("");
    els.packagesSection.hidden = false;
  }

  function renderRelated(destinations, destination, circuitsById, activitiesById) {
    if (!els.relatedSection || !els.related) return;
    if (!destinations.length || !Cards) {
      els.relatedSection.hidden = true;
      els.related.innerHTML = "";
      return;
    }

    if (els.relatedTitle && destination && destination.name) {
      els.relatedTitle.textContent = `Destinations near ${destination.name}`;
    }

    els.related.innerHTML = destinations
      .map((item) =>
        Cards.destinationCard(item, {
          circuitsById,
          activitiesById: activitiesById || {},
          preview,
        })
      )
      .join("");
    els.relatedSection.hidden = false;
  }

  async function resolveLoadOptions(wantsPreview) {
    if (!wantsPreview) return {};
    const availability = await Content.getFixtureAvailability();
    if (!availability.includeDevelopmentFixtures) return {};
    preview = true;
    document.body.dataset.fixtures = "preview";
    return { mode: "preview", includeFixtures: true };
  }

  function isPublicRecord(destination) {
    return (
      destination &&
      destination.status === "published" &&
      !destination.isFixture &&
      destination.contentOrigin === "production"
    );
  }

  async function init() {
    if (document.body.dataset.page !== "destination") return;

    if (!Content) {
      showNotFound("Destination data could not be loaded.");
      return;
    }

    const query = readQuery();
    if (!query.slug) {
      showNotFound(
        "No destination was specified. Choose a place from the destinations list, or send an enquiry and we will help you plan."
      );
      return;
    }

    try {
      const options = await resolveLoadOptions(query.preview);
      const destination = await Content.getDestinationBySlug(query.slug, options);

      if (!destination) {
        showNotFound(
          preview
            ? "No destination matches this link in the preview catalogue."
            : "This destination is not published, or the link may be incorrect."
        );
        return;
      }

      if (!preview && !isPublicRecord(destination)) {
        showNotFound("This destination is not published, or the link may be incorrect.");
        return;
      }

      const [circuits, activities, packages, related] = await Promise.all([
        Content.getCircuits(options),
        Content.getActivities(options),
        Content.getRelatedPackagesForDestination(destination, options),
        Content.getRelatedDestinations(destination, { ...options, limit: 4 }),
      ]);

      const circuitsById = Object.fromEntries((circuits || []).map((item) => [item.id, item]));
      const activitiesById = Object.fromEntries((activities || []).map((item) => [item.id, item]));
      const destinationsById = Object.fromEntries(
        (related || []).concat(destination).map((item) => [item.id, item])
      );
      const packageDestIds = (packages || []).flatMap((pkg) => pkg.destinationIds || []);
      await Promise.all(
        packageDestIds.map(async (id) => {
          if (destinationsById[id]) return;
          const record = await Content.getDestinationById(id, options);
          if (record) destinationsById[record.id] = record;
        })
      );

      const hasPackages = (packages || []).length > 0;

      applySeo(destination);
      renderHero(destination, circuitsById);
      renderGallery(destination);
      renderOverview(destination);
      renderHighlights(destination, activitiesById);
      renderPractical(destination, circuitsById);
      renderCtas(destination, hasPackages);
      renderPackages(packages || [], { circuitsById, destinationsById, activitiesById });
      renderRelated(related || [], destination, circuitsById, activitiesById);

      if (els.loading) els.loading.hidden = true;
      if (els.notFound) els.notFound.hidden = true;
      if (els.content) els.content.hidden = false;

      requestAnimationFrame(() => {
        observeReveals(document.querySelector(".dest-detail-main"));
        observeReveals(els.hero);
      });
    } catch (error) {
      console.error(error);
      showNotFound("Destination data could not be loaded.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
