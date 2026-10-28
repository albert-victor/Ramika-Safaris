/**
 * One-shot scraper: Southern Circuit destinations from tanzaniatourism.com
 * Emits intermediate import JSON, then maps into production/destinations.json.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const RamikaContentImport = require("../js/content/import/map.js");

const LISTING_URL = "https://www.tanzaniatourism.com/destinations/southern-circuit";
const CIRCUIT_ID = "circuit-southern";
const REGION = "Southern Tanzania";

const DEST_SLUGS = [
  "ruaha-national-park",
  "nyerere-national-park",
  "kitulo-national-park",
  "katavi-national-park",
  "kalambo-falls",
  "mbozi-meteorite",
  "lake-ngozi",
  "kaporogwe-falls",
  "matema-beach",
  "lake-nyasa",
  "mnazi-bay-ruvuma-estuary-marine-park",
  "igeleke-rock-art-site",
  "isimila-stone-age-site",
];

/** Activity tags taken from the Southern Circuit listing meta lines on TT. */
const DEST_META = {
  "ruaha-national-park": {
    touch: "Elephant country",
    activities: ["activity-wildlife", "activity-game-drives"],
    tags: "Adventure Safaris",
  },
  "nyerere-national-park": {
    touch: "River wilderness",
    activities: ["activity-wildlife", "activity-game-drives"],
    tags: "Adventure Safaris",
  },
  "kitulo-national-park": {
    touch: "Highland wildflowers",
    activities: ["activity-wildlife", "activity-day-walk", "activity-landscapes"],
    tags: "Adventure Safaris, Walking Safaris",
  },
  "katavi-national-park": {
    touch: "Floodplain wildlife",
    activities: ["activity-wildlife", "activity-game-drives"],
    tags: "Adventure Safaris",
  },
  "kalambo-falls": {
    touch: "Cliff & mist",
    activities: ["activity-landscapes"],
    tags: "Tourist Attractions",
  },
  "mbozi-meteorite": {
    touch: "Ancient stone",
    activities: ["activity-landscapes", "activity-cultural"],
    tags: "Tourist Attractions",
  },
  "lake-ngozi": {
    touch: "Crater lake",
    activities: ["activity-day-walk", "activity-landscapes"],
    tags: "Walking Safaris, Tourist Attractions",
  },
  "kaporogwe-falls": {
    touch: "Waterfall stop",
    activities: ["activity-landscapes"],
    tags: "Tourist Attractions",
  },
  "matema-beach": {
    touch: "Lake shore days",
    activities: ["activity-landscapes"],
    tags: "Beach Holiday",
  },
  "lake-nyasa": {
    touch: "Great lake",
    activities: ["activity-landscapes"],
    tags: "Tourist Attractions",
  },
  "mnazi-bay-ruvuma-estuary-marine-park": {
    touch: "Marine reserve",
    activities: ["activity-landscapes"],
    tags: "Beach Holiday",
  },
  "igeleke-rock-art-site": {
    touch: "Rock art",
    activities: ["activity-cultural", "activity-landscapes"],
    tags: "Tourist Attractions",
  },
  "isimila-stone-age-site": {
    touch: "Stone Age site",
    activities: ["activity-cultural", "activity-landscapes"],
    tags: "Tourist Attractions",
  },
};

function decodeHtml(text) {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripTags(html) {
  return decodeHtml(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/h\d>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function absUrl(src) {
  if (!src) return "";
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) return `https://www.tanzaniatourism.com${src}`;
  return src;
}

function isUsefulImage(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (!/\.(jpe?g|png|webp)(\?|$)/i.test(lower)) return false;
  if (/logo|icon|avatar|favicon|sprite|placeholder|blank|1x1|pixel/i.test(lower)) return false;
  if (/flags?\//i.test(lower)) return false;
  if (/\/images\/made\//i.test(lower)) return false; // prefer original uploads
  return true;
}

/** Collapse resized duplicates like Name_750_550shar-50brig-20_c1.jpg → Name.jpg */
function imageFingerprint(url) {
  const base = String(url || "")
    .split("?")[0]
    .split("/")
    .pop()
    .toLowerCase();
  return base
    .replace(/_\d+_\d+(?:shar-\d+)?(?:brig-\d+)?(?:_c\d+)?(?=\.(?:jpe?g|png|webp)$)/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RamikaSafarisContentImport/1.0; +https://ramikasafaris.local)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function extractMeta(html, name) {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
    "i"
  );
  const m = html.match(re) || html.match(re2);
  return m ? decodeHtml(m[1]) : "";
}

function extractTitle(html) {
  const og = extractMeta(html, "og:title");
  if (og) return og.replace(/\s*[|·].*$/, "").trim();
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripTags(h1[1]);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? stripTags(title[1]).split("|")[0].trim() : "";
}

function extractSectionByHeading(html, headingPattern) {
  const re = new RegExp(
    `<h[2-4][^>]*>\\s*${headingPattern}\\s*<\\/h[2-4]>([\\s\\S]*?)(?=<h[2-4][^>]*>|$)`,
    "i"
  );
  const m = html.match(re);
  return m ? m[1] : "";
}

function extractOverview(html) {
  // Prefer Overview tab/panel content when present.
  const overviewPanel =
    html.match(
      /id=["'](?:overview|tab-overview|destination-overview)["'][^>]*>([\s\S]*?)(?:<\/div>\s*<div[^>]+id=|<section|$)/i
    ) ||
    html.match(
      /class=["'][^"']*(?:overview|destination-content|entry-content)[^"']*["'][^>]*>([\s\S]*?)(?:<\/(?:div|section|article)>)/i
    );

  let block = overviewPanel ? overviewPanel[1] : "";

  if (!block) {
    // Between first substantial paragraphs after H1 and FAQs/Activities.
    const afterH1 = html.split(/<\/h1>/i)[1] || html;
    const cut = afterH1.split(
      /<(?:h2|h3)[^>]*>\s*(?:FAQs?|Activities|Safari Packages|Parks Nearby|Best Time)/i
    )[0];
    block = cut;
  }

  // Keep paragraph text only.
  const paragraphs = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((p) => p.length > 40)
    .filter(
      (p) =>
        !/cookie|subscribe|newsletter|leave this field|tours \/ safaris/i.test(p) &&
        !/southern circuit\s*\|/i.test(p)
    );

  // Deduplicate near-identical leads.
  const unique = [];
  for (const p of paragraphs) {
    if (unique.some((u) => u.slice(0, 80) === p.slice(0, 80))) continue;
    unique.push(p);
  }

  return unique.slice(0, 8).join("\n\n");
}

const WILDLIFE_NAMES = [
  "Elephant",
  "Lion",
  "Leopard",
  "Cheetah",
  "Wild dog",
  "Buffalo",
  "Giraffe",
  "Zebra",
  "Hippopotamus",
  "Hippo",
  "Crocodile",
  "Kudu",
  "Sable antelope",
  "Sable",
  "Roan",
  "Impala",
  "Eland",
  "Warthog",
  "Hyena",
  "Jackal",
  "Wildebeest",
  "Black rhino",
  "Waterbuck",
];

function extractWildlife(html, description, slug) {
  const section = extractSectionByHeading(html, "Wildlife\\s+Highlights?");
  const fromList = section
    ? [...section.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => stripTags(m[1])).filter(Boolean)
    : [];
  if (fromList.length) return fromList.slice(0, 12);

  // Only infer wildlife for parks/reserves — heritage/beach pages often mention painted animals.
  const isWildlifePlace = /national-park|game-reserve|marine-park|selous|nyerere|ruaha|katavi|mikumi/i.test(
    slug
  );
  if (!isWildlifePlace) return [];

  const text = `${stripTags(section)}\n${description || ""}`;
  const found = [];
  for (const name of WILDLIFE_NAMES) {
    if (new RegExp(`\\b${name.replace(/\s+/g, "\\s+")}s?\\b`, "i").test(text)) {
      const label = name === "Hippopotamus" ? "Hippo" : name === "Sable antelope" ? "Sable" : name;
      if (!found.includes(label)) found.push(label);
    }
  }
  return found.slice(0, 10);
}

function extractBestTime(html, description) {
  const faq = extractSectionByHeading(html, "FAQs?[\\s\\S]{0,40}");
  const blob = `${stripTags(faq)}\n${description || ""}`;

  const flower = blob.match(
    /(?:peak season|best time|wildflowers?)[^.…]{0,80}?\b((?:December|November)\s+to\s+(?:April|May))\b/i
  );
  if (flower) return `Peak wildflowers (${flower[1]})`;

  const dryParen = blob.match(/(?:dry season|drier months)[^.]*?\(([^)]+)\)/i);
  if (dryParen) {
    const firstRange = dryParen[1].split(/\s+and\s+/i)[0].trim();
    return `Dry season (${firstRange})`;
  }

  const dryBetween = blob.match(
    /(?:dry season|drier months|best time to visit)[^.…]{0,100}?\b((?:late\s+)?(?:May|June|July)\s*(?:to|-|–)\s*(?:October|November))\b/i
  );
  if (dryBetween) return `Dry season (${dryBetween[1].replace(/\s+/g, " ")})`;

  const explicit = blob.match(
    /best time to visit[^.…]{0,40}?\b((?:June|July|December)\s+to\s+(?:October|April|November))\b/i
  );
  if (explicit) return explicit[1];

  return null;
}

function destinationImageTokens(slug, name) {
  const stop = new Set([
    "national",
    "park",
    "falls",
    "lake",
    "beach",
    "bay",
    "site",
    "rock",
    "art",
    "stone",
    "age",
    "marine",
    "estuary",
    "the",
    "and",
  ]);
  const raw = `${slug} ${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3 && !stop.has(t));
  // Prefer distinctive tokens (ruaha, kitulo, mbozi…).
  return Array.from(new Set(raw));
}

function imageMatchesDestination(url, tokens) {
  if (!tokens.length) return true;
  const file = String(url || "").toLowerCase();
  return tokens.some((token) => file.includes(token));
}

function extractImages(html, name) {
  const found = [];
  const seen = new Set();
  const push = (src, alt) => {
    let url = absUrl(src);
    if (!url) return;
    // Promote made/ resized paths back to original uploads when possible.
    url = url.replace(
      /\/images\/made\/images\/uploads\/(.+?)_\d+_\d+(?:shar-\d+)?(?:brig-\d+)?(?:_c\d+)?(\.(?:jpe?g|png|webp))/i,
      "/images/uploads/$1$2"
    );
    if (!isUsefulImage(url)) return;
    const key = imageFingerprint(url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    found.push({
      src: url,
      alt: (alt && alt.trim()) || `${name}`,
    });
  };

  const ogImage = extractMeta(html, "og:image");
  if (ogImage) push(ogImage, name);

  const attrPairs = [
    ...html.matchAll(
      /<(?:img|a|div|figure)[^>]+(?:src|data-src|data-lazy-src|data-original|href)=["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["'][^>]*(?:alt=["']([^"']*)["'])?/gi
    ),
    ...html.matchAll(
      /(?:alt=["']([^"']*)["'][^>]*)?(?:src|data-src|data-lazy-src|data-original|href)=["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi
    ),
  ];

  for (const m of attrPairs) {
    if (m[2] && /\.(jpe?g|png|webp)/i.test(m[2]) && !/\.(jpe?g|png|webp)/i.test(m[1] || "")) {
      push(m[2], m[1]);
    } else {
      push(m[1], m[2]);
    }
  }

  found.sort((a, b) => {
    const score = (u) =>
      (/\/images\/uploads\//i.test(u.src) ? 0 : 2) +
      (/logo|banner-ads|partner/i.test(u.src) ? 5 : 0);
    return score(a) - score(b);
  });

  return found;
}

function introFromDescription(description) {
  const first = String(description || "")
    .split(/\n\s*\n/)[0]
    .trim();
  if (!first) return "";
  if (first.length <= 220) return first;
  const cut = first.slice(0, 217).replace(/\s+\S*$/, "");
  return `${cut}…`;
}

function slugToId(slug) {
  return `dest-${slug}`;
}

async function scrapeDestination(slug, index) {
  const url = `https://www.tanzaniatourism.com/destination/${slug}`;
  console.log(`[${index + 1}/${DEST_SLUGS.length}] ${slug}`);
  const html = await fetchText(url);
  const meta = DEST_META[slug] || {
    touch: "Southern circuit",
    activities: ["activity-landscapes"],
    tags: "Tourist Attractions",
  };
  const name = extractTitle(html) || slug.replace(/-/g, " ");
  const description = extractOverview(html);
  const intro = introFromDescription(description) || extractMeta(html, "description");
  const wildlifeHighlights = extractWildlife(html, description, slug);
  const bestTimeToVisit = extractBestTime(html, description);
  const allImages = extractImages(html, name);
  const tokens = destinationImageTokens(slug, name);
  const matched = allImages.filter((img) => imageMatchesDestination(img.src, tokens));
  // Prefer destination-named uploads; fall back to all page uploads if too few.
  const images = matched.length >= 3 ? matched : allImages;

  const heroImage = images[0] || allImages[0] || {
    src: extractMeta(html, "og:image") || "",
    alt: name,
  };

  // Exactly 5 unique photos for "See the area". Include hero first so the page
  // gallery renderer (gallery + hero, de-duplicated) stays at five images.
  const gallery = [];
  const pushGallery = (img) => {
    if (!img || !img.src || gallery.length >= 5) return;
    if (gallery.some((g) => g.src === img.src)) return;
    if (
      matched.length >= 3 &&
      !imageMatchesDestination(img.src, tokens) &&
      gallery.length >= Math.min(3, matched.length) &&
      img.src !== heroImage.src
    ) {
      return;
    }
    gallery.push({
      src: img.src,
      alt: img.alt || `${name} photograph`,
      caption: null,
    });
  };
  pushGallery(heroImage);
  for (const img of [...images, ...allImages]) pushGallery(img);

  return {
    id: slugToId(slug),
    slug,
    name,
    cardTitle: name,
    cardTouch: meta.touch,
    intro,
    description,
    heroImage: heroImage.src
      ? { src: heroImage.src, alt: heroImage.alt || name }
      : { src: "", alt: name },
    gallery,
    region: REGION,
    circuitIds: [CIRCUIT_ID],
    activityIds: meta.activities,
    wildlifeHighlights,
    bestTimeToVisit,
    relatedPackageIds: [],
    seo: {
      title: `${name} · Ramika Safaris and Tours`,
      description:
        intro ||
        `Explore ${name} on Tanzania’s southern circuit with Ramika Safaris and Tours.`,
    },
    status: "published",
    sourceUrl: url,
    sortOrder: index + 1,
  };
}

async function main() {
  // Soft-check listing is reachable (order already fixed to match live site).
  try {
    await fetchText(LISTING_URL);
  } catch (err) {
    console.warn("Listing fetch warning:", err.message);
  }

  const destinations = [];
  for (let i = 0; i < DEST_SLUGS.length; i += 1) {
    try {
      const dest = await scrapeDestination(DEST_SLUGS[i], i);
      destinations.push(dest);
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.error(`Failed ${DEST_SLUGS[i]}:`, err.message);
    }
  }

  const intermediatePath = path.join(root, "js/data/schemas/southern-circuit.import.json");
  const intermediate = {
    _meta: {
      kind: "import-intermediate",
      version: 1,
      source: LISTING_URL,
      note: "Southern Circuit destinations scraped from Tanzania Tourism, ordered as on the source listing.",
      scrapedAt: new Date().toISOString(),
    },
    destinations,
    packages: [],
    circuits: [],
    activities: [],
  };
  fs.writeFileSync(intermediatePath, `${JSON.stringify(intermediate, null, 2)}\n`, "utf8");
  console.log("Wrote", intermediatePath);

  const mapped = RamikaContentImport.mapImportDocument(intermediate, { origin: "production" });
  console.log("Map ok:", mapped.ok);
  console.log(
    "Issues:",
    mapped.issues.length ? JSON.stringify(mapped.issues, null, 2) : "none"
  );

  if (!mapped.ok) {
    process.exitCode = 1;
    return;
  }

  // Preserve source listing order (mapper keeps array order).
  const file = RamikaContentImport.toCollectionFile(
    "destinations",
    mapped.records.destinations,
    "Southern Circuit destinations imported from https://www.tanzaniatourism.com/destinations/southern-circuit. Ordered as on the source site. Each record includes overview copy, wildlife highlights when available, and a five-image gallery for the destination page."
  );

  // Keep sortOrder for transparency (non-schema field is fine in production file).
  file.items = file.items.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
    sourceUrl: destinations[index] && destinations[index].sourceUrl,
  }));

  const outPath = path.join(root, "js/data/production/destinations.json");
  fs.writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  console.log("Wrote", outPath);
  console.log(
    "Gallery counts:",
    file.items.map((d) => `${d.slug}:${(d.gallery || []).length}`).join(", ")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
