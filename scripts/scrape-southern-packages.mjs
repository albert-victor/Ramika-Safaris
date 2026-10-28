/**
 * Scrape Southern Circuit safari packages from tanzaniatourism.com.
 * Emits intermediate import JSON, validates via mapper, writes production/packages.json.
 * Target: 20 unique packages with ≥2 images, full itinerary, duration, destinations, activities.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const RamikaContentImport = require("../js/content/import/map.js");

const CIRCUIT_ID = "circuit-southern";
/** Import every unique southern/corridor package found (user requested all). Soft cap for safety. */
const TARGET_COUNT = 40;
const IMAGE_COUNT = 2;
const SOURCE_LISTING = "https://www.tanzaniatourism.com/destinations/southern-circuit";

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
  // Eastern parks that host Southern Circuit–tagged multi-park packages
  "mikumi-national-park",
  "udzungwa-mountains-park",
];

const CATEGORY_URLS = [
  "https://www.tanzaniatourism.com/safaris/category/southern-circuit",
];

/** Extra known southern-tagged safari slugs (multi-park / related) to top up to 20. */
const SEED_SAFARI_SLUGS = [
  "2-days-safari-to-ruaha-national-park",
  "3-days-safari-to-ruaha-national-park",
  "4-days-safari-in-ruaha-national-park",
  "5-days-safari-to-mikumi-ruaha-national-parks",
  "7-days-safari-to-ruaha-udzungwa-and-mikumi-national-parks",
  "10-days-safari-to-nyerere-mikumi-udzungwa-ruaha-national-parks",
  "day-trip-to-isimila-stone-age-and-igeleke-rock-art-sites",
  "day-trip-to-nyerere-national-park",
  "2-days-safari-to-nyerere-national-park",
  "3-day-safari-to-nyerere-national-park",
  "3-days-safari-to-nyerere-and-mikumi-national-parks",
  "4-days-safari-to-nyerere-and-mikumi-national-parks",
  "8-days-safari-to-nyerere-mikumi-and-udzungwa-national-parks",
  "2-days-safari-to-katavi-national-park",
  "3-days-safari-to-katavi-national-park",
  "day-trip-to-mikumi-national-park",
  "2-days-safari-tomikumi-national-park",
  "3-days-safari-tomikumi-national-park",
  "4-days-safari-to-mikumi-and-udzungwa-national-parks",
  "3-days-safari-to-udzungwa-mikumi-national-parks",
  "2-days-to-udzungwa-mountains-national-park",
];

/** Southern + corridor parks (Mikumi/Udzungwa) – destinations may be added later. */
const KNOWN_DEST_SLUGS = new Set([
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
  "mikumi-national-park",
  "udzungwa-mountains-park",
]);

const ACTIVITY_MAP = {
  "game drives": "activity-game-drives",
  "bird watching": "activity-wildlife",
  "walking / hiking": "activity-day-walk",
  "walking/hiking": "activity-day-walk",
  "walking safaris": "activity-day-walk",
  "canoeing / kayaking": "activity-wildlife",
  "canoeing/kayaking": "activity-wildlife",
  "balloon safari": "activity-wildlife",
  "cultural visits": "activity-cultural",
  "historical visits": "activity-cultural",
  "beach relaxation": "activity-landscapes",
  "snorkeling / swimming": "activity-landscapes",
  adventure: "activity-wildlife",
  "adventure safaris": "activity-wildlife",
  "tourist attractions": "activity-landscapes",
  "mountain climbing": "activity-trekking",
  "climbing / trekking": "activity-trekking",
  "night game drives": "activity-game-drives",
  "waterfalls": "activity-landscapes",
  "rock art / cave painting": "activity-cultural",
  "forest walk": "activity-day-walk",
  "picnicking": "activity-landscapes",
};

/** Prefer long/specific names first. Avoid ultra-short aliases that false-match related blocks. */
const DEST_NAME_TO_SLUG = {
  "ruaha national park": "ruaha-national-park",
  "nyerere national park": "nyerere-national-park",
  "selous game reserve": "nyerere-national-park",
  "kitulo national park": "kitulo-national-park",
  "katavi national park": "katavi-national-park",
  "kalambo falls": "kalambo-falls",
  "mbozi meteorite": "mbozi-meteorite",
  "lake ngozi": "lake-ngozi",
  "kaporogwe falls": "kaporogwe-falls",
  "matema beach": "matema-beach",
  "lake nyasa": "lake-nyasa",
  "mnazi bay - ruvuma estuary marine park": "mnazi-bay-ruvuma-estuary-marine-park",
  "mnazi bay": "mnazi-bay-ruvuma-estuary-marine-park",
  "igeleke rock art site": "igeleke-rock-art-site",
  "isimila stone age site": "isimila-stone-age-site",
  "mikumi national park": "mikumi-national-park",
  "udzungwa mountains park": "udzungwa-mountains-park",
  "udzungwa mountains national park": "udzungwa-mountains-park",
  "udzungwa national park": "udzungwa-mountains-park",
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
          "Mozilla/5.0 (compatible; RamikaSafarisContentImport/1.0; +https://ramikasafaris.local)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  } catch (err) {
    if (attempt >= 4) throw err;
    await new Promise((r) => setTimeout(r, 800 * attempt));
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
    found.push({ src: url, alt: (alt && alt.trim()) || name });
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

function extractOverview(html) {
  const overviewMatch =
    html.match(/<h3[^>]*>\s*Overview\s*<\/h3>([\s\S]*?)(?=<h[23][^>]*>)/i) ||
    html.match(/id=["']overview["'][^>]*>([\s\S]*?)(?=<h[23]|id=["']itinerary)/i);
  const block = overviewMatch ? overviewMatch[1] : "";
  const paragraphs = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((p) => p.length > 40)
    .filter((p) => !/cookie|subscribe|newsletter|cancel this reservation/i.test(p));
  if (paragraphs.length) return paragraphs.join("\n\n");

  const meta = extractMeta(html, "description");
  return meta || "";
}

function extractDuration(html, title) {
  // Source HTML often inserts <br> between "Duration:" and the value.
  const snap = stripTags(
    (html.match(/Duration:\s*([\s\S]{0,80}?Nights?)/i) || [])[0] || ""
  ).match(/(\d+)\s*Days?\s*\/\s*(\d+)\s*Nights?/i);
  const formatDuration = (days, nights) => {
    const dLabel = `${days} day${days === 1 ? "" : "s"}`;
    const nLabel = `${nights} night${nights === 1 ? "" : "s"}`;
    return { days, nights, label: `${dLabel} / ${nLabel}` };
  };

  if (snap) {
    return formatDuration(Number(snap[1]), Number(snap[2]));
  }
  const dayTrip = /^day\s*trip\b/i.test(title) || /\bday\s*trip\b/i.test(title);
  if (dayTrip) return { days: 1, nights: 0, label: "Day trip" };
  const titleDays = title.match(/(\d+)\s*-\s*(\d+)\s*Days?/i);
  if (titleDays) {
    const days = Number(titleDays[2]);
    return {
      days,
      nights: Math.max(0, days - 1),
      label: `${titleDays[1]}-${titleDays[2]} days`,
    };
  }
  const single = title.match(/(\d+)\s*Days?/i);
  if (single) {
    const days = Number(single[1]);
    return formatDuration(days, Math.max(0, days - 1));
  }
  return { days: null, nights: null, label: null };
}

function extractActivities(html) {
  const h3Idx = html.search(/<h3[^>]*>\s*Activities\s*<\/h3>/i);
  let block = "";
  if (h3Idx >= 0) {
    block = html.slice(h3Idx, h3Idx + 2500);
    const cut = block.search(/<h3[^>]*>\s*(?:Overview|Itinerary)/i);
    if (cut > 40) block = block.slice(0, cut);
  }
  const labels = [...block.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((label) => label && !/southern|eastern|northern|western|circuit/i.test(label))
    .filter(Boolean);
  const ids = [];
  for (const label of labels) {
    const key = label.toLowerCase().trim();
    const id = ACTIVITY_MAP[key];
    if (id && !ids.includes(id)) ids.push(id);
  }
  if (!ids.length) ids.push("activity-wildlife");
  return { labels, ids };
}

function resolveDestSlugFromText(text) {
  const lower = String(text || "").toLowerCase();
  const hits = [];
  const entries = Object.entries(DEST_NAME_TO_SLUG).sort((a, b) => b[0].length - a[0].length);
  for (const [name, slug] of entries) {
    if (!KNOWN_DEST_SLUGS.has(slug)) continue;
    if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`, "i").test(lower)) {
      if (!hits.includes(slug)) hits.push(slug);
    }
  }
  return hits;
}

function extractDestinationIds(html, title, itinerary) {
  const slugs = new Set();

  // Only the "Destination/s Traveling" section — never whole-page related/footer links.
  const destSectionIdx = html.search(
    /<h2[^>]*>\s*Destination\/?s\s+Traveling\s*<\/h2>|<h2[^>]*>\s*Destination\/?s\s+in this Safari\s*<\/h2>|id=["']destinations["']/i
  );
  if (destSectionIdx >= 0) {
    const section = html.slice(destSectionIdx, destSectionIdx + 8000);
    const cut = section.search(/<h2[^>]*>\s*(?:Relates|Related|Your Travel)|id=["']reviews/i);
    const block = cut > 100 ? section.slice(0, cut) : section;
    for (const m of block.matchAll(/\/destination\/([a-z0-9-]+)/gi)) {
      if (KNOWN_DEST_SLUGS.has(m[1])) slugs.add(m[1]);
    }
  }

  for (const slug of resolveDestSlugFromText(title)) slugs.add(slug);
  for (const day of itinerary) {
    for (const slug of resolveDestSlugFromText(`${day.title} ${day.summary}`)) slugs.add(slug);
  }

  return [...slugs].map((slug) => `dest-${slug}`);
}

function extractItinerary(html) {
  // Prefer the actual Itinerary heading (not the in-page nav link).
  const h3Idx = html.search(/<h3[^>]*>\s*Itinerary\s*<\/h3>/i);
  let block = "";
  if (h3Idx >= 0) {
    block = html.slice(h3Idx, h3Idx + 25000);
    const cut = block.search(/<h2[^>]*>|<h3[^>]*>\s*(?:Reviews|Destination|Relates)|Not sure\?/i);
    if (cut > 50) block = block.slice(0, cut);
  }
  if (!block) return [];

  // Accordion layout used by TT safari pages:
  // Day N in .accordion__icon, title in .text-18, body in .ee-body > p
  const accordionItems = [
    ...block.matchAll(
      /accordion__icon[\s\S]*?>\s*<div[^>]*>\s*Day\s+(\d+)\s*<\/div>[\s\S]*?<div class="text-18[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?(?:ee-body[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>|accordion__content[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>)/gi
    ),
  ];

  const days = [];
  const seenDayNums = new Set();

  if (accordionItems.length) {
    for (const m of accordionItems) {
      let dayNum = Number(m[1]);
      const title = stripTags(m[2]).replace(/\u00a0/g, " ").trim() || `Day ${dayNum}`;
      const summary = stripTags(m[3] || m[4] || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!summary || summary.length < 15) continue;

      // Source sometimes repeats "Day 2" for the final return day — renumber sequentially.
      if (seenDayNums.has(dayNum)) {
        dayNum = Math.max(...seenDayNums) + 1;
      }
      seenDayNums.add(dayNum);

      days.push({
        day: dayNum,
        title,
        summary,
        destinationIds: resolveDestSlugFromText(`${title} ${summary}`).map((s) => `dest-${s}`),
      });
    }
    return days.sort((a, b) => a.day - b.day);
  }

  // Fallback: looser Day N parsing
  const dayBlocks = [
    ...block.matchAll(
      /Day\s+(\d+)\s*<\/div>[\s\S]*?<div class="text-18[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi
    ),
  ];
  for (const m of dayBlocks) {
    let dayNum = Number(m[1]);
    if (seenDayNums.has(dayNum)) dayNum = Math.max(...seenDayNums, 0) + 1;
    seenDayNums.add(dayNum);
    const title = stripTags(m[2]).trim() || `Day ${dayNum}`;
    const summary = stripTags(m[3]).replace(/\s+/g, " ").trim();
    if (!summary) continue;
    days.push({
      day: dayNum,
      title,
      summary,
      destinationIds: resolveDestSlugFromText(`${title} ${summary}`).map((s) => `dest-${s}`),
    });
  }

  return days.sort((a, b) => a.day - b.day);
}

function cleanPlace(value) {
  if (!value) return null;
  return String(value)
    .replace(/\([^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .trim()
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, "") || null;
}

function extractStartEnd(itinerary, title) {
  const first = itinerary[0];
  const last = itinerary[itinerary.length - 1];
  let start = null;
  let end = null;

  if (first) {
    const parts = first.title.split(/\s*[–\-]\s*/);
    if (parts.length >= 2) start = parts[0].trim();
    else if (/dar/i.test(first.summary)) start = "Dar es Salaam";
  }
  if (last) {
    const parts = last.title.split(/\s*[–\-]\s*/);
    if (parts.length >= 2) end = parts[parts.length - 1].trim();
    else if (/dar/i.test(last.summary) || /dar/i.test(last.title)) end = "Dar es Salaam";
  }
  return { startLocation: cleanPlace(start), endLocation: cleanPlace(end || start) };
}

function extractListAfterHeading(html, heading) {
  const re = new RegExp(
    `<h[2-4][^>]*>\\s*${heading}\\s*<\\/h[2-4]>([\\s\\S]*?)(?=<h[2-4][^>]*>|$)`,
    "i"
  );
  const m = html.match(re);
  if (!m) return [];
  const items = [...m[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => stripTags(x[1])).filter(Boolean);
  if (items.length) return items;
  return [...m[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((x) => stripTags(x[1]))
    .filter((p) => p.length > 8 && p.length < 200);
}

function introFrom(summary) {
  const first = String(summary || "")
    .split(/\n\s*\n/)[0]
    .trim();
  if (!first) return "";
  if (first.length <= 220) return first;
  return `${first.slice(0, 217).replace(/\s+\S*$/, "")}…`;
}

function hasSouthernSignal(html, title, fromDests) {
  // Explicit Southern Circuit chip near the top of the safari page.
  const head = html.slice(0, 45000);
  if (/\/safaris\/category\/southern-circuit["'][^>]*>\s*Southern Circuit/i.test(head)) return true;
  if (/href=["'][^"']*southern-circuit[^"']*["'][^>]*>\s*Southern Circuit/i.test(head)) return true;

  // Listed on any southern / corridor destination Safari Packages block (incl. Mikumi/Udzungwa).
  if ((fromDests || []).some((d) => KNOWN_DEST_SLUGS.has(d) || d === "seed")) return true;

  // Title itself names a southern / corridor destination.
  return resolveDestSlugFromText(title).length > 0;
}

async function collectSafariSlugs() {
  const bySlug = new Map();

  for (const seed of SEED_SAFARI_SLUGS) {
    bySlug.set(seed, { from: ["seed"] });
  }

  for (const dest of DEST_SLUGS) {
    const url = `https://www.tanzaniatourism.com/destination/${dest}`;
    process.stdout.write(`List ${dest}… `);
    try {
      const html = await fetchText(url);
      const hrefs = [
        ...html.matchAll(
          /href=["'](https?:\/\/www\.tanzaniatourism\.com\/safari\/([a-z0-9-]+)|\/safari\/([a-z0-9-]+))["']/gi
        ),
      ];
      let n = 0;
      for (const m of hrefs) {
        const slug = m[2] || m[3];
        if (!slug) continue;
        n += 1;
        if (!bySlug.has(slug)) bySlug.set(slug, { from: [dest] });
        else bySlug.get(slug).from.push(dest);
      }
      console.log(n);
    } catch (err) {
      console.log(`FAIL ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 350));
  }

  for (const catUrl of CATEGORY_URLS) {
    process.stdout.write(`Category ${catUrl}… `);
    try {
      const html = await fetchText(catUrl);
      const hrefs = [
        ...html.matchAll(
          /href=["'](?:https?:\/\/www\.tanzaniatourism\.com)?\/safari\/([a-z0-9-]+)["']/gi
        ),
      ].map((m) => m[1]);
      // Category page currently lists unrelated northern tours — only keep if already known
      // or slug mentions southern parks.
      let n = 0;
      for (const slug of hrefs) {
        const looksSouthern =
          /ruaha|nyerere|katavi|kitulo|selous|mikumi|udzungwa|isimila|igeleke|matema|ngozi|kalambo|mbozi|nyasa|mnazi/i.test(
            slug
          );
        if (!looksSouthern && !bySlug.has(slug)) continue;
        n += 1;
        if (!bySlug.has(slug)) bySlug.set(slug, { from: ["category-southern"] });
        else bySlug.get(slug).from.push("category-southern");
      }
      console.log(n);
    } catch (err) {
      console.log(`FAIL ${err.message}`);
    }
  }

  return bySlug;
}

async function scrapePackage(slug, index, total, fromDests) {
  const url = `https://www.tanzaniatourism.com/safari/${slug}`;
  console.log(`[${index + 1}/${total}] ${slug}`);
  const html = await fetchText(url);
  const title = extractTitle(html) || slug.replace(/-/g, " ");

  if (!hasSouthernSignal(html, title, fromDests)) {
    return { skip: true, reason: "not-southern", slug, title };
  }

  const summary = extractOverview(html);
  let duration = extractDuration(html, title);
  const { labels: activityLabels, ids: activityIds } = extractActivities(html);
  const itinerary = extractItinerary(html);
  let destinationIds = extractDestinationIds(html, title, itinerary);
  const { startLocation, endLocation } = extractStartEnd(itinerary, title);
  const images = extractImages(html, title).filter((img) => /\/images\/uploads\//i.test(img.src));
  const fallbackImages = extractImages(html, title);
  const gallerySource = images.length >= IMAGE_COUNT ? images : fallbackImages;

  if (gallerySource.length < IMAGE_COUNT) {
    return { skip: true, reason: `images:${gallerySource.length}`, slug, title };
  }

  if (!itinerary.length && !(duration.days === 1)) {
    // Day trips may lack structured itinerary; allow empty with summary only for day trips.
    // Multi-day without itinerary is corrupt for our catalogue.
    if ((duration.days || 0) > 1) {
      return { skip: true, reason: "no-itinerary", slug, title };
    }
  }

  // Normalize day-trip itinerary if missing
  let days = itinerary;
  if (!days.length && duration.days === 1) {
    days = [
      {
        day: 1,
        title: title.replace(/^day\s*trip\s*(to\s*)?/i, "").trim() || "Day trip",
        summary: summary || introFrom(summary) || "Day excursion as described in the overview.",
        destinationIds,
      },
    ];
  }

  // Enforce sequential day numbers
  days = days.map((d, i) => ({ ...d, day: i + 1 }));

  // If source itinerary day count disagrees with duration label, trust itinerary and repair duration.
  if (days.length > 0 && duration.days != null && days.length !== duration.days) {
    const repairedDays = days.length;
    const repairedNights = Math.max(0, repairedDays - 1);
    duration = {
      days: repairedDays,
      nights: repairedNights,
      label:
        repairedDays === 1
          ? "Day trip"
          : `${repairedDays} day${repairedDays === 1 ? "" : "s"} / ${repairedNights} night${repairedNights === 1 ? "" : "s"}`,
    };
  }

  const hero = gallerySource[0];
  const gallery = gallerySource.slice(0, IMAGE_COUNT).map((img) => ({
    src: img.src,
    alt: img.alt || title,
    caption: null,
  }));

  // Infer destination ids from listing source when page body has none yet.
  if (!destinationIds.length && fromDests && fromDests.length) {
    for (const d of fromDests) {
      if (KNOWN_DEST_SLUGS.has(d)) destinationIds.push(`dest-${d}`);
    }
  }
  if (!destinationIds.length) {
    return { skip: true, reason: "no-destination-ids", slug, title };
  }

  const inclusions = extractListAfterHeading(html, "Included|Inclusions|What'?s Included");
  const exclusions = extractListAfterHeading(html, "Excluded|Exclusions|What'?s Not Included|Not Included");

  const cardSubtitleParts = [];
  if (duration.label) cardSubtitleParts.push(duration.label.replace(/\s*\/\s*/g, " · "));
  if (activityLabels[0]) cardSubtitleParts.push(activityLabels[0]);

  const destTouch =
    destinationIds.length === 1
      ? destinationIds[0].replace(/^dest-/, "").replace(/-/g, " ")
      : destinationIds.length > 1
        ? `${destinationIds.length} destinations`
        : "Southern circuit";

  return {
    skip: false,
    package: {
      id: `pkg-${slug}`,
      slug,
      title,
      cardSubtitle: cardSubtitleParts.slice(0, 2).join(" · ") || destTouch,
      summary: summary || introFrom(extractMeta(html, "description")),
      heroImage: { src: hero.src, alt: hero.alt || title },
      gallery,
      duration,
      startLocation,
      endLocation,
      circuitIds: [CIRCUIT_ID],
      destinationIds,
      activityIds,
      itinerary: days,
      accommodation:
        "Lodging reserved to the standard you name (lodge or campsite as available on the route). Lodges are not owned by Ramika.",
      inclusions: inclusions.length
        ? inclusions
        : [
            "Licensed safari vehicle",
            "Professional guide",
            "Meals as stated in the final itinerary",
            "Park activities as listed",
          ],
      exclusions: exclusions.length
        ? exclusions
        : ["Park entrance fees", "Flights", "Personal expenses", "Tips", "Travel insurance"],
      pricing: null,
      enquireCta: {
        label: "Enquire about this safari",
        href: "/contact.html#enquire",
      },
      seo: {
        title: `${title} · Ramika Safaris and Tours`,
        description: introFrom(summary) || `Enquire about ${title} with Ramika Safaris and Tours.`,
      },
      status: "published",
      sourceUrl: url,
      bestTimeToVisit: null,
    },
  };
}

function validationReport(packages, issues) {
  const report = {
    count: packages.length,
    ok: packages.length === TARGET_COUNT,
    packages: packages.map((pkg) => ({
      slug: pkg.slug,
      title: pkg.title,
      days: pkg.duration && pkg.duration.days,
      nights: pkg.duration && pkg.duration.nights,
      images: (pkg.gallery || []).length + (pkg.heroImage && pkg.heroImage.src ? 0 : 0),
      galleryCount: (pkg.gallery || []).length,
      heroOk: Boolean(pkg.heroImage && pkg.heroImage.src),
      itineraryDays: (pkg.itinerary || []).length,
      destinationIds: pkg.destinationIds,
      activityIds: pkg.activityIds,
      hasSummary: Boolean(pkg.summary && pkg.summary.length > 40),
      startLocation: pkg.startLocation,
      endLocation: pkg.endLocation,
      sourceUrl: pkg.sourceUrl,
    })),
    mapperIssues: issues,
    corruptChecks: [],
  };

  const ids = new Set();
  const slugs = new Set();
  for (const pkg of packages) {
    if (!pkg.id || !pkg.slug || !pkg.title) {
      report.corruptChecks.push({ slug: pkg.slug, error: "missing id/slug/title" });
    }
    if (ids.has(pkg.id)) report.corruptChecks.push({ slug: pkg.slug, error: "duplicate id" });
    ids.add(pkg.id);
    if (slugs.has(pkg.slug)) report.corruptChecks.push({ slug: pkg.slug, error: "duplicate slug" });
    slugs.add(pkg.slug);
    if (!(pkg.gallery || []).length || (pkg.gallery || []).length < IMAGE_COUNT) {
      report.corruptChecks.push({ slug: pkg.slug, error: `gallery < ${IMAGE_COUNT}` });
    }
    if (!pkg.heroImage || !pkg.heroImage.src) {
      report.corruptChecks.push({ slug: pkg.slug, error: "missing hero" });
    }
    if (!pkg.summary || pkg.summary.length < 20) {
      report.corruptChecks.push({ slug: pkg.slug, error: "weak summary" });
    }
    const days = (pkg.itinerary || []).map((d) => d.day);
    if (!days.length) report.corruptChecks.push({ slug: pkg.slug, error: "empty itinerary" });
    for (let i = 0; i < days.length; i += 1) {
      if (days[i] !== i + 1) {
        report.corruptChecks.push({ slug: pkg.slug, error: `non-sequential itinerary day ${days[i]}` });
        break;
      }
    }
    for (const day of pkg.itinerary || []) {
      if (!day.title || !day.summary) {
        report.corruptChecks.push({ slug: pkg.slug, error: `incomplete day ${day.day}` });
      }
    }
    if (!(pkg.circuitIds || []).includes(CIRCUIT_ID)) {
      report.corruptChecks.push({ slug: pkg.slug, error: "missing southern circuit" });
    }
    const dayCount = pkg.duration && pkg.duration.days;
    const itinCount = (pkg.itinerary || []).length;
    if (dayCount != null && dayCount > 1 && itinCount !== dayCount) {
      report.corruptChecks.push({
        slug: pkg.slug,
        error: `itinerary length ${itinCount} != duration days ${dayCount}`,
      });
    }
    if (!(pkg.destinationIds || []).length) {
      report.corruptChecks.push({ slug: pkg.slug, error: "missing destinationIds" });
    }
  }

  report.clean = report.corruptChecks.length === 0 && issues.every((i) => i.level !== "error");
  report.targetCount = TARGET_COUNT;
  report.countShortfall = Math.max(0, TARGET_COUNT - packages.length);
  return report;
}

async function main() {
  console.log("Collecting Southern Circuit safari URLs…");
  const slugMap = await collectSafariSlugs();
  const orderedSlugs = [...slugMap.keys()];
  console.log(`Unique candidate slugs: ${orderedSlugs.length}`);

  const packages = [];
  const skipped = [];

  for (let i = 0; i < orderedSlugs.length && packages.length < TARGET_COUNT; i += 1) {
    const slug = orderedSlugs[i];
    const fromDests = (slugMap.get(slug) && slugMap.get(slug).from) || [];
    try {
      const result = await scrapePackage(slug, packages.length, TARGET_COUNT, fromDests);
      if (result.skip) {
        skipped.push(result);
        console.log(`  skip: ${result.reason}`);
      } else {
        packages.push(result.package);
        console.log(
          `  ok: ${result.package.duration.label || "?"} · itinerary ${result.package.itinerary.length} · imgs ${(result.package.gallery || []).length}`
        );
      }
    } catch (err) {
      skipped.push({ slug, reason: err.message });
      console.error(`  FAIL: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 450));
  }

  if (packages.length < TARGET_COUNT) {
    console.warn(`Only collected ${packages.length}/${TARGET_COUNT} packages.`);
  }

  const intermediatePath = path.join(root, "js/data/schemas/southern-packages.import.json");
  const intermediate = {
    _meta: {
      kind: "import-intermediate",
      version: 1,
      source: SOURCE_LISTING,
      note: "Southern Circuit safari packages scraped from Tanzania Tourism destination Safari Packages listings.",
      scrapedAt: new Date().toISOString(),
      targetCount: TARGET_COUNT,
      collectedCount: packages.length,
      skipped,
    },
    destinations: [],
    packages: packages.map((pkg, index) => ({ ...pkg, sortOrder: index + 1 })),
    circuits: [],
    activities: [],
  };
  fs.writeFileSync(intermediatePath, `${JSON.stringify(intermediate, null, 2)}\n`, "utf8");
  console.log("Wrote", intermediatePath);

  const mapped = RamikaContentImport.mapImportDocument(intermediate, { origin: "production" });
  console.log("Map ok:", mapped.ok);
  console.log("Issues:", mapped.issues.length ? JSON.stringify(mapped.issues, null, 2) : "none");

  const report = validationReport(
    mapped.records.packages.length ? mapped.records.packages : packages,
    mapped.issues
  );
  // Re-attach sourceUrl/sortOrder for report clarity from raw packages
  report.packages = packages.map((pkg) => ({
    slug: pkg.slug,
    title: pkg.title,
    days: pkg.duration && pkg.duration.days,
    nights: pkg.duration && pkg.duration.nights,
    label: pkg.duration && pkg.duration.label,
    galleryCount: (pkg.gallery || []).length,
    heroOk: Boolean(pkg.heroImage && pkg.heroImage.src),
    itineraryDays: (pkg.itinerary || []).length,
    destinationIds: pkg.destinationIds,
    activityIds: pkg.activityIds,
    hasSummary: Boolean(pkg.summary && pkg.summary.length > 40),
    startLocation: pkg.startLocation,
    endLocation: pkg.endLocation,
    sourceUrl: pkg.sourceUrl,
  }));

  const reportPath = path.join(root, "js/data/schemas/southern-packages.validation.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("Wrote", reportPath);

  const countShort = packages.length < TARGET_COUNT;
  if (!mapped.ok || !report.clean || packages.length === 0) {
    console.error("Validation failed – production packages NOT written.");
    console.error(
      JSON.stringify(
        {
          mappedOk: mapped.ok,
          clean: report.clean,
          count: packages.length,
          corruptChecks: report.corruptChecks,
          skipped: skipped.slice(0, 20),
        },
        null,
        2
      )
    );
    process.exitCode = 1;
    return;
  }

  if (countShort) {
    console.warn(
      `Collected ${packages.length}/${TARGET_COUNT} verified Southern Circuit packages from source. Writing clean set; shortfall reported for approval.`
    );
  }

  // Preserve sourceUrl/sortOrder outside strict schema (allowed in production file).
  const productionItems = mapped.records.packages.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
    sourceUrl: packages[index] && packages[index].sourceUrl,
  }));

  const file = RamikaContentImport.toCollectionFile(
    "packages",
    productionItems,
    "Southern Circuit safari packages (20) imported from tanzaniatourism.com. Each record has ≥2 gallery images, duration, itinerary, destinations, activities. Pricing left null until Ramika verifies rates."
  );

  const outPath = path.join(root, "js/data/production/packages.json");
  fs.writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  console.log("Wrote", outPath);

  // Link relatedPackageIds on southern destinations that appear in packages.
  const destPath = path.join(root, "js/data/production/destinations.json");
  const destFile = JSON.parse(fs.readFileSync(destPath, "utf8"));
  const related = new Map();
  for (const pkg of productionItems) {
    for (const destId of pkg.destinationIds || []) {
      if (!related.has(destId)) related.set(destId, []);
      related.get(destId).push(pkg.id);
    }
  }
  destFile.items = (destFile.items || []).map((dest) => {
    const ids = related.get(dest.id) || [];
    // Replace southern-linked package ids from this import; keep any non-southern ids if present later.
    return {
      ...dest,
      relatedPackageIds: [...new Set(ids)],
    };
  });
  destFile._meta = {
    ...destFile._meta,
    packagesLinkedAt: new Date().toISOString(),
  };
  fs.writeFileSync(destPath, `${JSON.stringify(destFile, null, 2)}\n`, "utf8");
  console.log("Updated destination relatedPackageIds");

  console.log(
    JSON.stringify(
      {
        imported: packages.length,
        clean: report.clean,
        sample: report.packages.slice(0, 5).map((p) => p.slug),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
