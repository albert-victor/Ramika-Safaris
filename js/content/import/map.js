/**
 * Source-agnostic import mapper.
 * Accepts the documented intermediate format (see /js/data/schemas/expected-import.example.json)
 * and emits normalized internal records. Keep vendor-specific field remapping in a separate
 * adapter that outputs this intermediate shape – do not encode unknown source formats here.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../ramika-content.js"));
  } else {
    root.RamikaContentImport = factory(root.RamikaContent);
  }
})(typeof self !== "undefined" ? self : this, function (RamikaContent) {
  "use strict";

  if (!RamikaContent || !RamikaContent.normalize) {
    throw new Error("RamikaContentImport requires RamikaContent.normalize");
  }

  const normalize = RamikaContent.normalize;

  const ALIASES = {
    destinations: {
      id: ["id", "destinationId", "uuid"],
      slug: ["slug", "path", "permalink"],
      name: ["name", "title", "destinationName"],
      intro: ["intro", "summary", "shortIntroduction", "excerpt"],
      description: ["description", "body", "fullDescription", "content"],
      heroImage: ["heroImage", "hero", "image", "coverImage"],
      gallery: ["gallery", "images", "photos"],
      region: ["region", "location", "area"],
      circuitIds: ["circuitIds", "circuits", "circuit_ids"],
      activityIds: ["activityIds", "activities", "activity_ids"],
      wildlifeHighlights: ["wildlifeHighlights", "wildlife", "highlights"],
      bestTimeToVisit: ["bestTimeToVisit", "bestTime", "best_time_to_visit"],
      relatedPackageIds: ["relatedPackageIds", "packages", "packageIds"],
      seo: ["seo", "meta"],
      status: ["status", "publicationStatus", "state"],
    },
    packages: {
      id: ["id", "packageId", "uuid"],
      slug: ["slug", "path", "permalink"],
      title: ["title", "name", "packageName"],
      summary: ["summary", "intro", "excerpt"],
      heroImage: ["heroImage", "hero", "image", "coverImage"],
      gallery: ["gallery", "images", "photos"],
      duration: ["duration", "length"],
      startLocation: ["startLocation", "startsAt", "from"],
      endLocation: ["endLocation", "endsAt", "to"],
      circuitIds: ["circuitIds", "circuits"],
      destinationIds: ["destinationIds", "destinations"],
      activityIds: ["activityIds", "activities", "experiences"],
      itinerary: ["itinerary", "days", "dayByDay"],
      accommodation: ["accommodation", "lodging", "hotels"],
      inclusions: ["inclusions", "includes", "included"],
      exclusions: ["exclusions", "excludes", "excluded"],
      pricing: ["pricing", "price", "cost"],
      enquireCta: ["enquireCta", "cta", "enquiry"],
      seo: ["seo", "meta"],
      status: ["status", "publicationStatus", "state"],
    },
    circuits: {
      id: ["id", "circuitId"],
      slug: ["slug", "path"],
      name: ["name", "title"],
      script: ["script", "tagline"],
      summary: ["summary", "intro", "description"],
      region: ["region"],
      heroImage: ["heroImage", "image"],
      seo: ["seo", "meta"],
      status: ["status", "publicationStatus"],
    },
    activities: {
      id: ["id", "activityId"],
      slug: ["slug", "path"],
      name: ["name", "title"],
      summary: ["summary", "description"],
      category: ["category", "type"],
      image: ["image", "heroImage"],
      seo: ["seo", "meta"],
      status: ["status", "publicationStatus"],
    },
  };

  function pick(raw, keys) {
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") {
        return raw[key];
      }
    }
    return undefined;
  }

  function applyAliases(raw, collection) {
    const map = ALIASES[collection];
    if (!map || !raw || typeof raw !== "object") return raw;
    const out = { ...raw };
    Object.keys(map).forEach((canonical) => {
      if (out[canonical] === undefined || out[canonical] === null || out[canonical] === "") {
        const value = pick(raw, map[canonical]);
        if (value !== undefined) out[canonical] = value;
      }
    });
    return out;
  }

  function uniqueKeyIssues(items, label) {
    const issues = [];
    const ids = new Map();
    const slugs = new Map();

    items.forEach((item, index) => {
      if (!item) {
        issues.push({ level: "error", collection: label, index, message: "Record could not be normalized." });
        return;
      }
      if (ids.has(item.id)) {
        issues.push({
          level: "error",
          collection: label,
          index,
          id: item.id,
          message: `Duplicate id "${item.id}" (also at index ${ids.get(item.id)}).`,
        });
      } else {
        ids.set(item.id, index);
      }
      if (slugs.has(item.slug)) {
        issues.push({
          level: "error",
          collection: label,
          index,
          slug: item.slug,
          message: `Duplicate slug "${item.slug}" (also at index ${slugs.get(item.slug)}).`,
        });
      } else {
        slugs.set(item.slug, index);
      }
    });

    return issues;
  }

  function relationshipIssues(payload) {
    const issues = [];
    const destinationIds = new Set((payload.destinations || []).map((d) => d && d.id).filter(Boolean));
    const packageIds = new Set((payload.packages || []).map((p) => p && p.id).filter(Boolean));
    const circuitIds = new Set((payload.circuits || []).map((c) => c && c.id).filter(Boolean));
    const activityIds = new Set((payload.activities || []).map((a) => a && a.id).filter(Boolean));

    (payload.destinations || []).forEach((dest) => {
      if (!dest) return;
      (dest.circuitIds || []).forEach((id) => {
        if (circuitIds.size && !circuitIds.has(id)) {
          issues.push({
            level: "warning",
            collection: "destinations",
            id: dest.id,
            message: `Unknown circuitId "${id}". Ensure circuits are imported or already present in production.`,
          });
        }
      });
      (dest.relatedPackageIds || []).forEach((id) => {
        if (packageIds.size && !packageIds.has(id)) {
          issues.push({
            level: "warning",
            collection: "destinations",
            id: dest.id,
            message: `relatedPackageId "${id}" not present in this import batch.`,
          });
        }
      });
      (dest.activityIds || []).forEach((id) => {
        if (activityIds.size && !activityIds.has(id)) {
          issues.push({
            level: "warning",
            collection: "destinations",
            id: dest.id,
            message: `Unknown activityId "${id}".`,
          });
        }
      });
    });

    (payload.packages || []).forEach((pkg) => {
      if (!pkg) return;
      (pkg.destinationIds || []).forEach((id) => {
        if (destinationIds.size && !destinationIds.has(id)) {
          issues.push({
            level: "warning",
            collection: "packages",
            id: pkg.id,
            message: `destinationId "${id}" not present in this import batch.`,
          });
        }
      });
      (pkg.itinerary || []).forEach((day) => {
        if (!day || !day.title) {
          issues.push({
            level: "warning",
            collection: "packages",
            id: pkg.id,
            message: "Itinerary entry missing title; incomplete days are dropped or labelled by day number.",
          });
        }
      });
      if (pkg.pricing && pkg.pricing.amount == null && !pkg.pricing.note) {
        issues.push({
          level: "info",
          collection: "packages",
          id: pkg.id,
          message: "Pricing object present without amount – stored as null pricing detail only.",
        });
      }
    });

    return issues;
  }

  function mapCollection(rawItems, collection, origin) {
    const normalizer =
      collection === "destinations"
        ? normalize.destination
        : collection === "packages"
          ? normalize.package
          : collection === "circuits"
            ? normalize.circuit
            : normalize.activity;

    return (Array.isArray(rawItems) ? rawItems : []).map((raw) =>
      normalizer(applyAliases(raw, collection), origin || "production")
    );
  }

  /**
   * @param {object} intermediate – expected import document
   * @param {{ origin?: "production"|"fixture" }} [options]
   * @returns {{ records: object, issues: object[], ok: boolean }}
   */
  function mapImportDocument(intermediate, options) {
    const origin = (options && options.origin) || "production";
    const source = intermediate && typeof intermediate === "object" ? intermediate : {};

    const records = {
      destinations: mapCollection(source.destinations, "destinations", origin).filter(Boolean),
      packages: mapCollection(source.packages, "packages", origin).filter(Boolean),
      circuits: mapCollection(source.circuits, "circuits", origin).filter(Boolean),
      activities: mapCollection(source.activities, "activities", origin).filter(Boolean),
    };

    const issues = []
      .concat(uniqueKeyIssues(records.destinations, "destinations"))
      .concat(uniqueKeyIssues(records.packages, "packages"))
      .concat(uniqueKeyIssues(records.circuits, "circuits"))
      .concat(uniqueKeyIssues(records.activities, "activities"))
      .concat(relationshipIssues(records));

    const hasErrors = issues.some((issue) => issue.level === "error");

    return {
      records,
      issues,
      ok: !hasErrors,
    };
  }

  /**
   * Serialize mapped records into the on-disk collection file shape used under js/data/production.
   */
  function toCollectionFile(collection, items, note) {
    return {
      _meta: {
        kind: "production-content",
        collection,
        version: 1,
        note: note || `Imported ${collection} records.`,
        importedAt: new Date().toISOString(),
      },
      items: Array.isArray(items) ? items.map((item) => {
        if (!item) return item;
        const clone = { ...item };
        delete clone.contentOrigin;
        delete clone.isFixture;
        return clone;
      }) : [],
    };
  }

  return {
    ALIASES,
    applyAliases,
    mapImportDocument,
    toCollectionFile,
  };
});
