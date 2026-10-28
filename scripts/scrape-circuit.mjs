/**
 * Circuit destination importer for tanzaniatourism.com.
 * Usage: node scripts/scrape-circuit.mjs northern
 * Merges into js/data/production/destinations.json without wiping other circuits.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const RamikaContentImport = require("../js/content/import/map.js");

const CIRCUITS = {
  northern: {
    listingUrl: "https://www.tanzaniatourism.com/destinations/northern-circuit",
    circuitId: "circuit-northern",
    region: "Northern Tanzania",
    limit: 10,
    destinations: [
      {
        slug: "serengeti-national-park",
        touch: "Great Migration plains",
        activities: ["activity-wildlife", "activity-game-drives"],
        tags: "Adventure Safaris",
      },
      {
        slug: "mount-kilimanjaro-national-park",
        touch: "Summit routes",
        activities: ["activity-trekking"],
        tags: "Mountain Climbing",
      },
      {
        slug: "arusha-national-park",
        touch: "Meru foothills",
        activities: ["activity-wildlife", "activity-game-drives", "activity-day-walk"],
        tags: "Adventure Safaris",
      },
      {
        slug: "lake-manyara-national-park",
        touch: "Tree-climbing lions",
        activities: ["activity-wildlife", "activity-game-drives"],
        tags: "Adventure Safaris",
      },
      {
        slug: "ngorongoro-crater",
        touch: "Crater floor",
        activities: ["activity-wildlife", "activity-game-drives"],
        tags: "Adventure Safaris",
      },
      {
        slug: "tarangire-national-park",
        touch: "Baobab elephant country",
        activities: ["activity-wildlife", "activity-game-drives"],
        tags: "Adventure Safaris",
      },
      {
        slug: "mkomazi-national-park",
        touch: "Open northern bush",
        activities: ["activity-wildlife", "activity-game-drives"],
        tags: "Adventure Safaris",
      },
      {
        slug: "mount-oldoinyo-lengai",
        touch: "Sacred volcano",
        activities: ["activity-trekking", "activity-landscapes"],
        tags: "Mountain Climbing",
      },
      {
        slug: "lake-natron",
        touch: "Soda lake shore",
        activities: ["activity-wildlife", "activity-landscapes"],
        tags: "Adventure Safaris",
      },
      {
        slug: "kondoa-rock-art-sites",
        touch: "UNESCO rock art",
        activities: ["activity-cultural", "activity-landscapes"],
        tags: "Tourist Attractions",
      },
    ],
  },
  western: {
    listingUrl: "https://www.tanzaniatourism.com/destinations/western-circuit",
    circuitId: "circuit-western",
    region: "Western Tanzania",
    // TT Western Circuit currently lists 9 destinations (not 10).
    limit: 9,
    destinations: [
      {
        slug: "gombe-stream-national-park",
        touch: "Chimpanzee forest",
        activities: ["activity-wildlife", "activity-day-walk", "activity-trekking"],
        tags: "Adventure Safaris",
      },
      {
        slug: "mahale-mountains-national-park",
        touch: "Lakeside chimps",
        activities: ["activity-wildlife", "activity-trekking", "activity-day-walk"],
        tags: "Adventure Safaris, Mountain Climbing",
      },
      {
        slug: "saanane-island-national-park",
        touch: "Island park walks",
        activities: ["activity-wildlife", "activity-day-walk"],
        tags: "Adventure Safaris, Walking Safaris",
      },
      {
        slug: "rubondo-island-national-park",
        touch: "Lake Victoria island",
        activities: ["activity-wildlife", "activity-day-walk"],
        tags: "Adventure Safaris",
      },
      {
        slug: "ukerewe-island",
        touch: "Island villages",
        activities: ["activity-day-walk", "activity-cultural", "activity-landscapes"],
        tags: "Walking Safaris, Tourist Attractions",
      },
      {
        slug: "burigi-chato-national-park",
        touch: "Western plains",
        activities: ["activity-wildlife", "activity-game-drives"],
        tags: "Adventure Safaris",
      },
      {
        slug: "ibanda-kyerwa-national-park",
        touch: "Border wilderness",
        activities: ["activity-wildlife", "activity-game-drives"],
        tags: "Adventure Safaris",
      },
      {
        slug: "lake-tanganyika",
        touch: "Rift lake shore",
        activities: ["activity-landscapes"],
        tags: "Tourist Attractions",
      },
      {
        slug: "lake-victoria",
        touch: "Africa's great lake",
        activities: ["activity-landscapes"],
        tags: "Tourist Attractions",
      },
    ],
  },
  /**
   * TT "Zanzibar Island" listing only has the hub page. To reach 10 published
   * destinations we combine Zanzibar hub + Zanzibar islets + Mafia + Dar/Tanga
   * ocean reserves that exist as real /destination/* pages (verified titles).
   */
  zanzibar: {
    listingUrl: "https://www.tanzaniatourism.com/destinations/zanzibar-island",
    circuitId: "circuit-zanzibar",
    region: "Zanzibar and the coast",
    limit: 10,
    destinations: [
      {
        slug: "zanzibar-island",
        touch: "Spice island shores",
        activities: ["activity-landscapes", "activity-cultural"],
        tags: "Beach Holiday, Tourist Attractions",
      },
      {
        slug: "mnemba-island-conservation-area",
        touch: "Reef sanctuary",
        activities: ["activity-landscapes"],
        tags: "Beach Holiday",
      },
      {
        slug: "chumbe-island-marine-sanctuary",
        touch: "Coral sanctuary",
        activities: ["activity-landscapes", "activity-day-walk"],
        tags: "Beach Holiday, Walking Safaris",
      },
      {
        slug: "mafia-island",
        touch: "Quiet marine isle",
        activities: ["activity-landscapes"],
        tags: "Beach Holiday",
      },
      {
        slug: "mbudya-island-marine-reserve",
        touch: "Dar day-island",
        activities: ["activity-landscapes"],
        tags: "Beach Holiday",
      },
      {
        slug: "bongoyo-island-marine-reserve",
        touch: "Coastal snorkel stop",
        activities: ["activity-landscapes"],
        tags: "Beach Holiday",
      },
      {
        slug: "pangavini-island-marine-reserve",
        touch: "Bird island reserve",
        activities: ["activity-landscapes"],
        tags: "Beach Holiday",
      },
      {
        slug: "fungu-yasin-sand-bar",
        touch: "Sandbar swim",
        activities: ["activity-landscapes"],
        tags: "Beach Holiday",
      },
      {
        slug: "sinda-island-marine-reserve",
        touch: "Reef day trip",
        activities: ["activity-landscapes"],
        tags: "Beach Holiday",
      },
      {
        slug: "maziwe-island-marine-reserve",
        touch: "Tanga tide island",
        activities: ["activity-landscapes"],
        tags: "Beach Holiday",
      },
    ],
  },
};

function decodeHtml(text) {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;|&lsquo;|&#8217;|&#8216;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    // TT sometimes mangles possessives to "Africa/s" or "Ngorongoro/s".
    .replace(/([A-Za-z])\/s\b/g, "$1's");
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
  if (/\/images\/made\//i.test(lower)) return false;
  return true;
}

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

async function fetchText(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  } catch (err) {
    if (attempt >= 4) throw err;
    const wait = 1200 * attempt;
    console.warn(`Retry ${attempt} ${url.split("/").pop()}: ${err.message}`);
    await new Promise((r) => setTimeout(r, wait));
    return fetchText(url, attempt + 1);
  }
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
  const overviewPanel =
    html.match(
      /id=["'](?:overview|tab-overview|destination-overview)["'][^>]*>([\s\S]*?)(?:<\/div>\s*<div[^>]+id=|<section|$)/i
    ) ||
    html.match(
      /class=["'][^"']*(?:overview|destination-content|entry-content)[^"']*["'][^>]*>([\s\S]*?)(?:<\/(?:div|section|article)>)/i
    );

  let block = overviewPanel ? overviewPanel[1] : "";
  if (!block) {
    const afterH1 = html.split(/<\/h1>/i)[1] || html;
    block = afterH1.split(
      /<(?:h2|h3)[^>]*>\s*(?:FAQs?|Activities|Safari Packages|Parks Nearby|Best Time)/i
    )[0];
  }

  const paragraphs = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((p) => p.length > 40)
    .filter(
      (p) =>
        !/cookie|subscribe|newsletter|leave this field|tours \/ safaris/i.test(p) &&
        !/(?:northern|southern|western|eastern)\s+circuit\s*\|/i.test(p)
    );

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
  "Sable",
  "Roan",
  "Impala",
  "Eland",
  "Warthog",
  "Hyena",
  "Jackal",
  "Wildebeest",
  "Black rhino",
  "Rhino",
  "Waterbuck",
  "Flamingo",
  "Gazelle",
  "Chimpanzee",
  "Colobus",
];

function extractWildlife(html, description, slug) {
  const section =
    extractSectionByHeading(html, "Wildlife\\s+Highlights?") ||
    extractSectionByHeading(html, "[^<]{0,40}Wildlife");
  const fromList = section
    ? [...section.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => stripTags(m[1])).filter(Boolean)
    : [];
  if (fromList.length) return fromList.slice(0, 12);

  const isWildlifePlace =
    /national-park|game-reserve|marine-park|crater|serengeti|manyara|tarangire|ngorongoro|mkomazi|arusha|natron|ruaha|nyerere|katavi|mikumi|gombe|mahale|rubondo|burigi|ibanda|saanane/i.test(
      slug
    );
  if (!isWildlifePlace) return [];

  // Prefer dedicated wildlife section + overview. Also include flamingo/breeding
  // sections when present, but never the full page (footers inject unrelated parks).
  const flamingoBit = extractSectionByHeading(html, "[^<]{0,60}Flamingos?");
  const text = `${stripTags(section)}\n${stripTags(flamingoBit)}\n${description || ""}`;
  const found = [];
  for (const name of WILDLIFE_NAMES) {
    if (new RegExp(`\\b${name.replace(/\s+/g, "\\s+")}s?\\b`, "i").test(text)) {
      const label =
        name === "Hippopotamus" ? "Hippo" : name === "Rhino" ? "Rhino" : name === "Black rhino" ? "Black rhino" : name;
      if (!found.includes(label)) found.push(label);
    }
  }
  if (found.includes("Black rhino")) {
    return found.filter((item) => item !== "Rhino").slice(0, 10);
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

  const coolest = blob.match(
    /best months? to visit[^.]{0,80}?(?:coolest[^.]{0,40}?)?\b((?:from\s+)?(?:June|July|August)\s+to\s+(?:August|September|October))\b/i
  );
  if (coolest) {
    return coolest[1].replace(/^from\s+/i, "").replace(/\s+/g, " ");
  }

  const dryParen = blob.match(/(?:dry season|drier months)[^.]*?\(([^)]+)\)/i);
  if (dryParen) {
    const firstRange = dryParen[1].split(/\s+and\s+/i)[0].trim();
    // Reject distance/noise captures like "113 km".
    if (!/\b\d+\s*(?:km|miles?)\b/i.test(firstRange) && /[A-Za-z]{3,}/.test(firstRange)) {
      return `Dry season (${firstRange})`;
    }
  }

  const dryBetween = blob.match(
    /(?:dry season|drier months|best time to visit|best time|best months?)[^.…]{0,120}?\b((?:late\s+)?(?:January|February|May|June|July|December)\s*(?:to|through|-|–)\s*(?:February|March|August|October|November|September))\b/i
  );
  if (dryBetween) {
    const value = dryBetween[1].replace(/\s+/g, " ");
    if (/dry/i.test(blob.slice(Math.max(0, dryBetween.index - 40), dryBetween.index + 40))) {
      return `Dry season (${value})`;
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  const climb = blob.match(
    /best (?:time|months?) (?:to )?(?:climb|visit)[^.…]{0,80}?\b((?:January|June|July|August|September|December)[^.]{0,40})\./i
  );
  if (climb) {
    const value = climb[1].replace(/\s+/g, " ").trim();
    if (value.length < 80 && !/\b\d+\s*(?:km|miles?)\b/i.test(value)) {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
  }

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
    "sites",
    "rock",
    "art",
    "stone",
    "age",
    "marine",
    "estuary",
    "mount",
    "mountain",
    "the",
    "and",
  ]);
  const raw = `${slug} ${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3 && !stop.has(t));
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
    url = url.replace(
      /\/images\/made\/images\/uploads\/(.+?)_\d+_\d+(?:shar-\d+)?(?:brig-\d+)?(?:_c\d+)?(\.(?:jpe?g|png|webp))/i,
      "/images/uploads/$1$2"
    );
    if (!isUsefulImage(url)) return;
    const key = imageFingerprint(url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    found.push({ src: url, alt: (alt && alt.trim()) || `${name}` });
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
      (/\/images\/uploads\//i.test(u.src) ? 0 : 2) + (/logo|banner-ads|partner/i.test(u.src) ? 5 : 0);
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
  return `${first.slice(0, 217).replace(/\s+\S*$/, "")}…`;
}

function titleMatchesSlug(name, slug) {
  const tokens = destinationImageTokens(slug, name);
  if (!tokens.length) return true;
  const hay = String(name || "").toLowerCase();
  // TT soft-404s unknown slugs onto Serengeti – reject that mismatch.
  if (/serengeti/i.test(hay) && !/serengeti/i.test(slug)) return false;
  return tokens.some((token) => hay.includes(token));
}

async function scrapeDestination(entry, index, total, circuit) {
  const { slug, touch, activities } = entry;
  const url = `https://www.tanzaniatourism.com/destination/${slug}`;
  console.log(`[${index + 1}/${total}] ${slug}`);
  const html = await fetchText(url);
  const name = extractTitle(html) || slug.replace(/-/g, " ");
  if (!titleMatchesSlug(name, slug)) {
    throw new Error(`Title/slug mismatch (likely soft-404): "${name}" vs ${slug}`);
  }
  const description = extractOverview(html);
  const intro = introFromDescription(description) || extractMeta(html, "description");
  const wildlifeHighlights = extractWildlife(html, description, slug);
  const bestTimeToVisit = extractBestTime(html, description);
  const allImages = extractImages(html, name);
  const tokens = destinationImageTokens(slug, name);
  const matched = allImages.filter((img) => imageMatchesDestination(img.src, tokens));
  const images = matched.length >= 3 ? matched : allImages;

  const heroImage = images[0] || allImages[0] || {
    src: extractMeta(html, "og:image") || "",
    alt: name,
  };

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
    id: `dest-${slug}`,
    slug,
    name,
    cardTitle: name,
    cardTouch: touch,
    intro,
    description,
    heroImage: heroImage.src
      ? { src: heroImage.src, alt: heroImage.alt || name }
      : { src: "", alt: name },
    gallery,
    region: circuit.region,
    circuitIds: [circuit.circuitId],
    activityIds: activities,
    wildlifeHighlights,
    bestTimeToVisit,
    relatedPackageIds: [],
    seo: {
      title: `${name} · Ramika Safaris and Tours`,
      description:
        intro || `Explore ${name} with Ramika Safaris and Tours.`,
    },
    status: "published",
    sourceUrl: url,
    sortOrder: index + 1,
  };
}

function mergeProduction(existingItems, incomingItems, circuitId) {
  const keep = (existingItems || []).filter(
    (item) => !(item.circuitIds || []).includes(circuitId)
  );
  const byId = new Map(keep.map((item) => [item.id, item]));
  const bySlug = new Map(keep.map((item) => [item.slug, item]));
  const merged = [...keep];

  for (const item of incomingItems) {
    if (byId.has(item.id) || bySlug.has(item.slug)) {
      throw new Error(`Slug/id clash with existing catalogue: ${item.slug} (${item.id})`);
    }
    merged.push(item);
  }
  return merged;
}

async function main() {
  const key = String(process.argv[2] || "").toLowerCase();
  const circuit = CIRCUITS[key];
  if (!circuit) {
    console.error(`Usage: node scripts/scrape-circuit.mjs <${Object.keys(CIRCUITS).join("|")}>`);
    process.exit(1);
  }

  const entries = circuit.destinations.slice(0, circuit.limit || circuit.destinations.length);
  const destinations = [];
  for (let i = 0; i < entries.length; i += 1) {
    try {
      destinations.push(await scrapeDestination(entries[i], i, entries.length, circuit));
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.error(`Failed ${entries[i].slug}:`, err.message);
    }
  }

  if (destinations.length !== entries.length) {
    console.error(`Expected ${entries.length} destinations, scraped ${destinations.length}`);
    process.exitCode = 1;
    return;
  }

  const intermediatePath = path.join(root, `js/data/schemas/${key}-circuit.import.json`);
  const intermediate = {
    _meta: {
      kind: "import-intermediate",
      version: 1,
      source: circuit.listingUrl,
      note: `${key} circuit destinations scraped from Tanzania Tourism (first ${entries.length} in listing order).`,
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
  if (mapped.issues.length) console.log("Issues:", JSON.stringify(mapped.issues, null, 2));
  if (!mapped.ok) {
    process.exitCode = 1;
    return;
  }

  const mappedItems = mapped.records.destinations.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
    sourceUrl: destinations[index].sourceUrl,
    circuitKey: key,
  }));

  const outPath = path.join(root, "js/data/production/destinations.json");
  const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
  const mergedItems = mergeProduction(existing.items || [], mappedItems, circuit.circuitId);

  const counts = {
    southern: mergedItems.filter((i) => (i.circuitIds || []).includes("circuit-southern")).length,
    northern: mergedItems.filter((i) => (i.circuitIds || []).includes("circuit-northern")).length,
    western: mergedItems.filter((i) => (i.circuitIds || []).includes("circuit-western")).length,
    zanzibar: mergedItems.filter((i) => (i.circuitIds || []).includes("circuit-zanzibar")).length,
  };

  const file = {
    _meta: {
      kind: "production-content",
      collection: "destinations",
      version: 1,
      note: `Merged catalogue. Southern: ${counts.southern}. Northern: ${counts.northern}. Western: ${counts.western}. Zanzibar: ${counts.zanzibar}. Latest import: ${key} from ${circuit.listingUrl}.`,
      importedAt: new Date().toISOString(),
    },
    items: mergedItems,
  };

  fs.writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  console.log("Wrote", outPath);
  console.log(
    "Gallery counts:",
    mappedItems.map((d) => `${d.slug}:${(d.gallery || []).length}`).join(", ")
  );
  console.log(`Totals — ${JSON.stringify(counts)}, all: ${mergedItems.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
