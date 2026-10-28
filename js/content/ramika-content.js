/**
 * Ramika content access layer.
 * Separates catalogue data (destinations, packages, circuits, activities, sections)
 * from page presentation. Published queries never silently fall back to fixtures.
 *
 * Browser: window.RamikaContent
 * Node (smoke checks): require("./ramika-content.js") when run under CommonJS evaluation
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.RamikaContent = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const COLLECTIONS = ["destinations", "packages", "circuits", "activities", "sections"];
  const PUBLIC_STATUSES = Object.freeze(["published"]);
  const PREVIEW_STATUSES = Object.freeze(["published", "draft"]);
  const DEFAULT_ENQUIRE = Object.freeze({
    label: "Enquire about a safari",
    href: "/contact.html#enquire",
  });

  const DEFAULT_CONFIG = Object.freeze({
    includeDevelopmentFixtures: false,
    paths: {
      production: {
        destinations: "/js/data/production/destinations.json",
        packages: "/js/data/production/packages.json",
        circuits: "/js/data/production/circuits.json",
        activities: "/js/data/production/activities.json",
        sections: "/js/data/production/sections.json",
      },
      fixtures: {
        destinations: "/js/data/fixtures/destinations.json",
        packages: "/js/data/fixtures/packages.json",
        circuits: "/js/data/fixtures/circuits.json",
        activities: "/js/data/fixtures/activities.json",
        homePage: "/js/data/home-fixtures.json",
      },
    },
    publication: {
      publicStatuses: PUBLIC_STATUSES.slice(),
      previewStatuses: PREVIEW_STATUSES.slice(),
    },
  });

  /** @type {object | null} */
  let cachedConfig = null;
  /** @type {Promise<object> | null} */
  let configPromise = null;
  /** @type {Map<string, Promise<object>>} */
  const fileCache = new Map();
  /** @type {{ production: object, fixtures: object } | null} */
  let catalogCache = null;
  /** @type {Promise<{ production: object, fixtures: object }> | null} */
  let catalogPromise = null;

  /** Optional Node filesystem injector for offline verification. */
  let nodeFs = null;
  let nodeRoot = null;

  function setNodeIO(fsModule, rootDir) {
    nodeFs = fsModule;
    nodeRoot = rootDir;
    clearCaches();
  }

  function clearCaches() {
    cachedConfig = null;
    configPromise = null;
    fileCache.clear();
    catalogCache = null;
    catalogPromise = null;
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function asString(value, fallback = "") {
    if (value == null) return fallback;
    return String(value).trim();
  }

  function asNullableString(value) {
    const text = asString(value, "");
    return text ? text : null;
  }

  function slugify(value) {
    return asString(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeImage(input) {
    if (!input) return null;
    if (typeof input === "string") {
      const src = asString(input);
      return src ? { src, alt: "" } : null;
    }
    if (!isPlainObject(input)) return null;
    const src = asString(input.src || input.url || input.path);
    if (!src) return null;
    return {
      src,
      alt: asString(input.alt),
      caption: asNullableString(input.caption),
    };
  }

  function normalizeGallery(input) {
    return asArray(input)
      .map(normalizeImage)
      .filter(Boolean);
  }

  function normalizeStatus(value) {
    const status = asString(value, "draft").toLowerCase();
    if (status === "published" || status === "draft" || status === "archived") return status;
    return "draft";
  }

  function normalizeSeo(input, fallbackTitle) {
    const seo = isPlainObject(input) ? input : {};
    return {
      title: asString(seo.title, fallbackTitle || ""),
      description: asString(seo.description),
    };
  }

  function normalizeIdList(value) {
    return asArray(value)
      .map((item) => asString(item))
      .filter(Boolean);
  }

  function normalizeDuration(input) {
    if (input == null || input === "") return null;
    if (typeof input === "string" || typeof input === "number") {
      return {
        days: null,
        nights: null,
        label: asString(input),
      };
    }
    if (!isPlainObject(input)) return null;
    const days = Number.isFinite(Number(input.days)) ? Number(input.days) : null;
    const nights = Number.isFinite(Number(input.nights)) ? Number(input.nights) : null;
    const label = asNullableString(input.label);
    if (days == null && nights == null && !label) return null;
    return { days, nights, label };
  }

  function normalizePricing(input) {
    if (input == null || input === "") return null;
    if (!isPlainObject(input)) return null;
    const amountRaw = input.amount;
    const amount =
      amountRaw == null || amountRaw === ""
        ? null
        : Number.isFinite(Number(amountRaw))
          ? Number(amountRaw)
          : null;
    const currency = asNullableString(input.currency);
    const note = asNullableString(input.note);
    if (amount == null && !currency && !note) return null;
    return { amount, currency, note };
  }

  function normalizeCta(input, fallback) {
    const source = isPlainObject(input) ? input : fallback || DEFAULT_ENQUIRE;
    return {
      label: asString(source.label, DEFAULT_ENQUIRE.label),
      href: asString(source.href, DEFAULT_ENQUIRE.href),
    };
  }

  function normalizeItinerary(input) {
    return asArray(input)
      .map((day, index) => {
        if (!isPlainObject(day)) return null;
        const dayNumber = Number.isFinite(Number(day.day)) ? Number(day.day) : index + 1;
        const title = asString(day.title);
        const summary = asString(day.summary || day.description);
        if (!title && !summary) return null;
        return {
          day: dayNumber,
          title: title || `Day ${dayNumber}`,
          summary,
          destinationIds: normalizeIdList(day.destinationIds),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.day - b.day);
  }

  function normalizeDestination(raw, origin) {
    if (!isPlainObject(raw)) return null;
    const name = asString(raw.name || raw.title);
    const id = asString(raw.id) || (name ? `dest-${slugify(name)}` : "");
    const slug = asString(raw.slug) || slugify(name);
    if (!id || !slug || !name) return null;

    return {
      id,
      slug,
      name,
      cardTitle: asNullableString(raw.cardTitle),
      cardTouch: asNullableString(raw.cardTouch),
      intro: asString(raw.intro || raw.summary || raw.shortIntroduction),
      description: asString(raw.description || raw.body || raw.fullDescription),
      heroImage: normalizeImage(raw.heroImage || raw.hero || raw.image),
      gallery: normalizeGallery(raw.gallery || raw.images),
      region: asNullableString(raw.region || raw.location),
      circuitIds: normalizeIdList(raw.circuitIds || raw.circuits),
      activityIds: normalizeIdList(raw.activityIds || raw.activities),
      wildlifeHighlights: asArray(raw.wildlifeHighlights || raw.wildlife)
        .map((item) => asString(item))
        .filter(Boolean),
      bestTimeToVisit: asNullableString(raw.bestTimeToVisit || raw.bestTime),
      relatedPackageIds: normalizeIdList(raw.relatedPackageIds || raw.packages),
      seo: normalizeSeo(raw.seo, name),
      status: normalizeStatus(raw.status),
      contentOrigin: origin,
      isFixture: origin === "fixture",
    };
  }

  function normalizePackage(raw, origin) {
    if (!isPlainObject(raw)) return null;
    const title = asString(raw.title || raw.name);
    const id = asString(raw.id) || (title ? `pkg-${slugify(title)}` : "");
    const slug = asString(raw.slug) || slugify(title);
    if (!id || !slug || !title) return null;

    return {
      id,
      slug,
      title,
      cardSubtitle: asNullableString(raw.cardSubtitle),
      summary: asString(raw.summary || raw.intro),
      heroImage: normalizeImage(raw.heroImage || raw.hero || raw.image),
      gallery: normalizeGallery(raw.gallery || raw.images),
      duration: normalizeDuration(raw.duration),
      startLocation: asNullableString(raw.startLocation || raw.startsAt),
      endLocation: asNullableString(raw.endLocation || raw.endsAt),
      circuitIds: normalizeIdList(raw.circuitIds || raw.circuits),
      destinationIds: normalizeIdList(raw.destinationIds || raw.destinations),
      activityIds: normalizeIdList(raw.activityIds || raw.activities || raw.experiences),
      itinerary: normalizeItinerary(raw.itinerary || raw.days),
      accommodation: asNullableString(raw.accommodation || raw.lodging),
      inclusions: asArray(raw.inclusions).map((item) => asString(item)).filter(Boolean),
      exclusions: asArray(raw.exclusions).map((item) => asString(item)).filter(Boolean),
      pricing: normalizePricing(raw.pricing || raw.price),
      enquireCta: normalizeCta(raw.enquireCta || raw.cta, DEFAULT_ENQUIRE),
      seo: normalizeSeo(raw.seo, title),
      status: normalizeStatus(raw.status),
      contentOrigin: origin,
      isFixture: origin === "fixture",
    };
  }

  function normalizeCircuit(raw, origin) {
    if (!isPlainObject(raw)) return null;
    const name = asString(raw.name || raw.title);
    const id = asString(raw.id) || (name ? `circuit-${slugify(name)}` : "");
    const slug = asString(raw.slug) || slugify(name);
    if (!id || !slug || !name) return null;

    return {
      id,
      slug,
      name,
      script: asNullableString(raw.script),
      summary: asString(raw.summary || raw.intro || raw.description),
      region: asNullableString(raw.region),
      heroImage: normalizeImage(raw.heroImage || raw.image),
      seo: normalizeSeo(raw.seo, name),
      status: normalizeStatus(raw.status),
      contentOrigin: origin,
      isFixture: origin === "fixture",
    };
  }

  function normalizeActivity(raw, origin) {
    if (!isPlainObject(raw)) return null;
    const name = asString(raw.name || raw.title);
    const id = asString(raw.id) || (name ? `activity-${slugify(name)}` : "");
    const slug = asString(raw.slug) || slugify(name);
    if (!id || !slug || !name) return null;

    return {
      id,
      slug,
      name,
      summary: asString(raw.summary || raw.description),
      category: asNullableString(raw.category),
      featured: Boolean(raw.featured),
      sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : 999,
      sourceUrl: asNullableString(raw.sourceUrl),
      image: normalizeImage(raw.image || raw.heroImage),
      seo: normalizeSeo(raw.seo, name),
      status: normalizeStatus(raw.status),
      contentOrigin: origin,
      isFixture: origin === "fixture",
    };
  }

  function normalizeSection(raw, origin) {
    if (!isPlainObject(raw)) return null;
    const id = asString(raw.id || raw.key);
    if (!id) return null;
    return {
      id,
      key: asString(raw.key, id),
      kicker: asNullableString(raw.kicker),
      script: asNullableString(raw.script),
      headline: asString(raw.headline || raw.title),
      lede: asNullableString(raw.lede || raw.intro),
      body: Array.isArray(raw.body) ? raw.body.map((p) => asString(p)).filter(Boolean) : asNullableString(raw.body),
      image: normalizeImage(raw.image),
      cta: raw.cta ? normalizeCta(raw.cta) : null,
      items: asArray(raw.items),
      status: normalizeStatus(raw.status || "published"),
      contentOrigin: origin,
      isFixture: origin === "fixture",
    };
  }

  const NORMALIZERS = {
    destinations: normalizeDestination,
    packages: normalizePackage,
    circuits: normalizeCircuit,
    activities: normalizeActivity,
    sections: normalizeSection,
  };

  /**
   * Deduplicate by stable id (preferred) then slug.
   * Production records always win over fixtures when ids/slugs collide.
   */
  function mergeRecords(productionItems, fixtureItems, allowFixtures) {
    const byId = new Map();
    const bySlug = new Map();
    const order = [];

    function add(record, preferExisting) {
      if (!record) return;
      const existingById = byId.get(record.id);
      const existingBySlug = bySlug.get(record.slug);

      if (existingById) {
        if (preferExisting) return;
        const idx = order.indexOf(existingById);
        if (idx >= 0) order[idx] = record;
        byId.set(record.id, record);
        bySlug.set(record.slug, record);
        return;
      }

      if (existingBySlug) {
        // Duplicate slug with different id – keep production / first record.
        if (preferExisting || existingBySlug.contentOrigin === "production") return;
        const idx = order.indexOf(existingBySlug);
        if (idx >= 0) order[idx] = record;
        byId.delete(existingBySlug.id);
        byId.set(record.id, record);
        bySlug.set(record.slug, record);
        return;
      }

      byId.set(record.id, record);
      bySlug.set(record.slug, record);
      order.push(record);
    }

    productionItems.forEach((item) => add(item, false));
    if (allowFixtures) {
      fixtureItems.forEach((item) => add(item, true));
    }

    return order.slice();
  }

  function resolveUrlPath(urlPath) {
    if (!nodeFs || !nodeRoot) return urlPath;
    const relative = String(urlPath || "").replace(/^\/+/, "");
    return require("path").join(nodeRoot, relative);
  }

  async function fetchJson(urlPath) {
    if (fileCache.has(urlPath)) return fileCache.get(urlPath);

    const pending = (async () => {
      if (nodeFs && nodeRoot) {
        const absolute = resolveUrlPath(urlPath);
        const text = nodeFs.readFileSync(absolute, "utf8");
        return JSON.parse(text);
      }

      const response = await fetch(urlPath, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`Failed to load ${urlPath} (${response.status})`);
      }
      return response.json();
    })();

    fileCache.set(urlPath, pending);
    return pending;
  }

  async function loadConfig() {
    if (cachedConfig) return cachedConfig;
    if (configPromise) return configPromise;

    configPromise = (async () => {
      try {
        const raw = await fetchJson("/js/data/content.config.json");
        cachedConfig = {
          ...DEFAULT_CONFIG,
          ...raw,
          paths: {
            production: { ...DEFAULT_CONFIG.paths.production, ...(raw.paths && raw.paths.production) },
            fixtures: { ...DEFAULT_CONFIG.paths.fixtures, ...(raw.paths && raw.paths.fixtures) },
          },
          publication: {
            publicStatuses: asArray(raw.publication && raw.publication.publicStatuses).length
              ? asArray(raw.publication.publicStatuses)
              : PUBLIC_STATUSES.slice(),
            previewStatuses: asArray(raw.publication && raw.publication.previewStatuses).length
              ? asArray(raw.publication.previewStatuses)
              : PREVIEW_STATUSES.slice(),
          },
          includeDevelopmentFixtures: Boolean(raw.includeDevelopmentFixtures),
        };
      } catch (error) {
        console.warn("RamikaContent: using default content config.", error);
        cachedConfig = { ...DEFAULT_CONFIG, includeDevelopmentFixtures: false };
      }
      return cachedConfig;
    })();

    return configPromise;
  }

  function readCollectionItems(payload, collection, origin) {
    const normalize = NORMALIZERS[collection];
    const items = asArray(payload && payload.items);
    return items.map((item) => normalize(item, origin)).filter(Boolean);
  }

  async function loadOriginCatalog(origin, paths) {
    const result = {};
    await Promise.all(
      COLLECTIONS.map(async (collection) => {
        const url = paths[collection];
        if (!url) {
          result[collection] = [];
          return;
        }
        try {
          const payload = await fetchJson(url);
          result[collection] = readCollectionItems(payload, collection, origin);
        } catch (error) {
          console.warn(`RamikaContent: missing ${origin} ${collection}.`, error);
          result[collection] = [];
        }
      })
    );
    return result;
  }

  async function loadCatalog(force) {
    if (!force && catalogCache) return catalogCache;
    if (!force && catalogPromise) return catalogPromise;

    catalogPromise = (async () => {
      const config = await loadConfig();
      const production = await loadOriginCatalog("production", config.paths.production);
      let fixtures = {
        destinations: [],
        packages: [],
        circuits: [],
        activities: [],
        sections: [],
      };
      if (config.includeDevelopmentFixtures) {
        fixtures = await loadOriginCatalog("fixture", config.paths.fixtures);
      }
      catalogCache = { production, fixtures, config };
      return catalogCache;
    })();

    return catalogPromise;
  }

  function fixturesAllowed(config, options) {
    if (!config.includeDevelopmentFixtures) return false;
    return Boolean(options && (options.includeFixtures || options.mode === "preview"));
  }

  function statusAllowed(record, statuses) {
    return statuses.includes(record.status);
  }

  function selectCollection(catalog, collection, options) {
    const config = catalog.config;
    const allowFixtures = fixturesAllowed(config, options);
    const mode = options && options.mode === "preview" ? "preview" : "published";
    const statuses =
      mode === "preview"
        ? config.publication.previewStatuses
        : config.publication.publicStatuses;

    const merged = mergeRecords(
      catalog.production[collection] || [],
      catalog.fixtures[collection] || [],
      allowFixtures
    );

    let items = merged.filter((item) => statusAllowed(item, statuses));

    // Hard rule: published mode never returns fixture records.
    if (mode === "published") {
      items = items.filter((item) => !item.isFixture && item.contentOrigin === "production");
    }

    if (options && options.circuitId) {
      items = items.filter((item) => asArray(item.circuitIds).includes(options.circuitId));
    }
    if (options && options.activityId) {
      items = items.filter((item) => asArray(item.activityIds).includes(options.activityId));
    }
    if (options && options.destinationId) {
      items = items.filter((item) => asArray(item.destinationIds).includes(options.destinationId));
    }

    return items;
  }

  async function query(collection, options) {
    const catalog = await loadCatalog();
    return selectCollection(catalog, collection, options || {});
  }

  async function findBySlug(collection, slug, options) {
    const needle = asString(slug);
    if (!needle) return null;
    const items = await query(collection, options);
    return items.find((item) => item.slug === needle) || null;
  }

  async function findById(collection, id, options) {
    const needle = asString(id);
    if (!needle) return null;
    const items = await query(collection, options);
    return items.find((item) => item.id === needle) || null;
  }

  async function getRelatedPackagesForDestination(destination, options) {
    if (!destination) return [];
    const packages = await query("packages", options);
    const relatedIds = new Set(asArray(destination.relatedPackageIds));
    return packages.filter(
      (pkg) => relatedIds.has(pkg.id) || asArray(pkg.destinationIds).includes(destination.id)
    );
  }

  async function getRelatedDestinationsForPackage(pkg, options) {
    if (!pkg) return [];
    const destinations = await query("destinations", options);
    const relatedIds = new Set(asArray(pkg.destinationIds));
    return destinations.filter((dest) => relatedIds.has(dest.id));
  }

  /**
   * Other destinations sharing a circuit or region with the current record.
   * Does not invent relationships – only matches existing ids/region strings.
   */
  async function getRelatedDestinations(destination, options) {
    if (!destination) return [];
    const limit = Number.isFinite(Number(options && options.limit))
      ? Number(options.limit)
      : 3;
    const destinations = await query("destinations", options);
    const circuitSet = new Set(asArray(destination.circuitIds));
    const region = asString(destination.region);

    const scored = destinations
      .filter((item) => item && item.id !== destination.id)
      .map((item) => {
        const sharedCircuits = asArray(item.circuitIds).filter((id) => circuitSet.has(id)).length;
        const sameRegion = region && item.region === region ? 1 : 0;
        return { item, score: sharedCircuits * 2 + sameRegion };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));

    return scored.slice(0, Math.max(0, limit)).map((entry) => entry.item);
  }

  async function getHomePageFixtures() {
    const config = await loadConfig();
    if (!config.includeDevelopmentFixtures) {
      return null;
    }
    const url = config.paths.fixtures.homePage || "/js/data/home-fixtures.json";
    try {
      return await fetchJson(url);
    } catch (error) {
      console.warn("RamikaContent: homepage fixtures unavailable.", error);
      return null;
    }
  }

  async function getFixtureAvailability() {
    const config = await loadConfig();
    return {
      includeDevelopmentFixtures: Boolean(config.includeDevelopmentFixtures),
      disableSteps: asArray(config.disableFixtures && config.disableFixtures.steps),
    };
  }

  /**
   * Card projection helpers for list UIs – keep presentation mapping out of pages.
   */
  const DESTINATION_CARD_TITLES = {
    mikumi: "Mikumi National Park",
    "kitulo-plateau": "Kitulo Plateau National Park",
  };

  function destinationCardTitle(destination) {
    if (!destination) return "";
    if (asString(destination.cardTitle)) return asString(destination.cardTitle);
    if (destination.slug && DESTINATION_CARD_TITLES[destination.slug]) {
      return DESTINATION_CARD_TITLES[destination.slug];
    }
    return asString(destination.name);
  }

  function destinationCardTouch(destination) {
    if (!destination) return null;
    if (asString(destination.cardTouch)) return asString(destination.cardTouch);
    return null;
  }

  const LOCAL_GALLERY_FALLBACK = {
    src: "/images/about_Activities/kitulo_main.jpg",
    alt: "Southern highlands landscape from the Ramika Safaris and Tours gallery.",
  };

  function isLocalGallerySrc(src) {
    return String(src || "").includes("/images/about_Activities/");
  }

  function cardGalleryImages(record, limit) {
    const max = Number.isFinite(limit) ? limit : 2;
    const images = [];
    const push = (image, { allowLocal = true } = {}) => {
      if (!image || !image.src) return;
      if (!allowLocal && isLocalGallerySrc(image.src)) return;
      if (images.some((item) => item.src === image.src)) return;
      images.push(image);
    };

    // Prefer imported / remote catalogue images first.
    push(record && record.heroImage, { allowLocal: false });
    asArray(record && record.gallery).forEach((image) => push(image, { allowLocal: false }));

    // Fall back to any remaining record images (including local gallery).
    if (!images.length) {
      push(record && record.heroImage, { allowLocal: true });
      asArray(record && record.gallery).forEach((image) => push(image, { allowLocal: true }));
    }

    // Last resort: shared local gallery photo.
    if (!images.length) push(LOCAL_GALLERY_FALLBACK, { allowLocal: true });

    return images.slice(0, max);
  }

  function toDestinationCard(destination, context) {
    if (!destination) return null;
    const circuitsById = (context && context.circuitsById) || {};
    const activitiesById = (context && context.activitiesById) || {};
    const circuitNames = asArray(destination.circuitIds)
      .map((id) => circuitsById[id] && circuitsById[id].name)
      .filter(Boolean);
    const activityNames = asArray(destination.activityIds)
      .map((id) => activitiesById[id] && activitiesById[id].name)
      .filter(Boolean);
    const tags = [];
    if (destination.region) tags.push(destination.region);
    activityNames.slice(0, 2).forEach((name) => {
      if (!tags.includes(name)) tags.push(name);
    });
    const images = cardGalleryImages(destination, 2);
    return {
      id: destination.id,
      slug: destination.slug,
      title: destinationCardTitle(destination),
      shortTitle: asString(destination.name),
      touchline: destinationCardTouch(destination),
      summary: destination.intro || "",
      location: destination.region,
      circuitLabel: circuitNames[0] || null,
      circuitLabels: circuitNames,
      tags: tags.slice(0, 3),
      category: activityNames[0] || null,
      href: `/destination.html?slug=${encodeURIComponent(destination.slug)}`,
      image: images[0] || destination.heroImage,
      images,
      isFixture: destination.isFixture,
      status: destination.status,
    };
  }

  function formatPackagePrice(pricing) {
    if (!pricing || pricing.amount == null || !Number.isFinite(Number(pricing.amount))) {
      return null;
    }
    const amount = Number(pricing.amount);
    const currency = asString(pricing.currency, "USD");
    const formatted = Number.isInteger(amount)
      ? String(amount)
      : amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `${currency} ${formatted}`;
  }

  function toPackageCard(pkg, context) {
    if (!pkg) return null;
    const circuitsById = (context && context.circuitsById) || {};
    const destinationsById = (context && context.destinationsById) || {};
    const activitiesById = (context && context.activitiesById) || {};

    const circuitNames = asArray(pkg.circuitIds)
      .map((id) => circuitsById[id] && circuitsById[id].name)
      .filter(Boolean);
    const destinationNames = asArray(pkg.destinationIds)
      .map((id) => destinationsById[id] && destinationsById[id].name)
      .filter(Boolean);
    const activityNames = asArray(pkg.activityIds)
      .map((id) => activitiesById[id] && activitiesById[id].name)
      .filter(Boolean);

    const durationLabel =
      (pkg.duration && pkg.duration.label) ||
      (pkg.duration && pkg.duration.days != null
        ? `${pkg.duration.days} day${pkg.duration.days === 1 ? "" : "s"}`
        : null);

    const images = cardGalleryImages(pkg, 2);
    return {
      id: pkg.id,
      slug: pkg.slug,
      title: pkg.title,
      subtitle:
        asString(pkg.cardSubtitle) ||
        [destinationNames[0], circuitNames[0]].filter(Boolean).join(" · ") ||
        null,
      duration: durationLabel,
      durationDays:
        pkg.duration && Number.isFinite(Number(pkg.duration.days))
          ? Number(pkg.duration.days)
          : null,
      circuitLabel: circuitNames[0] || null,
      circuitLabels: circuitNames,
      destinationLabel: destinationNames[0] || null,
      destinationLabels: destinationNames,
      activityLabels: activityNames,
      category: activityNames[0] || null,
      priceLabel: formatPackagePrice(pkg.pricing),
      summary: pkg.summary,
      href: `/package.html?slug=${encodeURIComponent(pkg.slug)}`,
      image: images[0] || pkg.heroImage,
      images,
      isFixture: pkg.isFixture,
      status: pkg.status,
    };
  }

  function toCircuitCard(circuit) {
    if (!circuit) return null;
    return {
      id: circuit.id,
      title: circuit.name,
      script: circuit.script,
      summary: circuit.summary,
      href: `/circuit.html?slug=${encodeURIComponent(circuit.slug)}`,
      image: circuit.heroImage,
      isFixture: circuit.isFixture,
      status: circuit.status,
    };
  }

  return {
    COLLECTIONS,
    PUBLIC_STATUSES,
    PREVIEW_STATUSES,
    clearCaches,
    setNodeIO,
    loadConfig,
    loadCatalog,
    getFixtureAvailability,
    getHomePageFixtures,
    getDestinations: (options) => query("destinations", options),
    getPackages: (options) => query("packages", options),
    getCircuits: (options) => query("circuits", options),
    getActivities: (options) => query("activities", options),
    getSections: (options) => query("sections", options),
    getDestinationBySlug: (slug, options) => findBySlug("destinations", slug, options),
    getPackageBySlug: (slug, options) => findBySlug("packages", slug, options),
    getCircuitBySlug: (slug, options) => findBySlug("circuits", slug, options),
    getActivityBySlug: (slug, options) => findBySlug("activities", slug, options),
    getDestinationById: (id, options) => findById("destinations", id, options),
    getPackageById: (id, options) => findById("packages", id, options),
    getRelatedPackagesForDestination,
    getRelatedDestinationsForPackage,
    getRelatedDestinations,
    toDestinationCard,
    toPackageCard,
    toCircuitCard,
    normalize: {
      destination: normalizeDestination,
      package: normalizePackage,
      circuit: normalizeCircuit,
      activity: normalizeActivity,
      section: normalizeSection,
      image: normalizeImage,
      slugify,
    },
  };
});
