/**
 * Scrape Northern Circuit safari packages from tanzaniatourism.com.
 * Merges into production/packages.json (keeps existing southern packages).
 * Target: 20 unique packages with ≥2 images, itinerary, duration, destinations.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const RamikaContentImport = require("../js/content/import/map.js");

const CIRCUIT_ID = "circuit-northern";
const TARGET_COUNT = 20;
const IMAGE_COUNT = 2;
const SOURCE_LISTING = "https://www.tanzaniatourism.com/destinations/northern-circuit";

const DEST_SLUGS = [
  "serengeti-national-park",
  "mount-kilimanjaro-national-park",
  "arusha-national-park",
  "lake-manyara-national-park",
  "ngorongoro-crater",
  "tarangire-national-park",
  "mkomazi-national-park",
  "mount-oldoinyo-lengai",
  "lake-natron",
  "kondoa-rock-art-sites",
  "lake-chala",
  "lake-jipe",
  "lake-eyasi",
  "pare-mountains",
  "mount-meru",
  "ngurdoto-crater",
];

const KNOWN_DEST_SLUGS = new Set(DEST_SLUGS);

const ACTIVITY_MAP = {
  "game drives": "activity-game-drives",
  "bird watching": "activity-wildlife",
  "walking / hiking": "activity-day-walk",
  "walking/hiking": "activity-day-walk",
  "walking safaris": "activity-day-walk",
  "canoeing / kayaking": "activity-wildlife",
  "balloon safari": "activity-wildlife",
  "cultural visits": "activity-cultural",
  "historical visits": "activity-cultural",
  "mountain climbing": "activity-trekking",
  "climbing / trekking": "activity-trekking",
  "great migration": "activity-wildlife",
  "night game drives": "activity-game-drives",
  "adventure safaris": "activity-wildlife",
  "tourist attractions": "activity-landscapes",
  "forest walk": "activity-day-walk",
};

const DEST_NAME_TO_SLUG = {
  "serengeti national park": "serengeti-national-park",
  serengeti: "serengeti-national-park",
  "mount kilimanjaro national park": "mount-kilimanjaro-national-park",
  "kilimanjaro national park": "mount-kilimanjaro-national-park",
  kilimanjaro: "mount-kilimanjaro-national-park",
  "arusha national park": "arusha-national-park",
  "lake manyara national park": "lake-manyara-national-park",
  "lake manyara": "lake-manyara-national-park",
  "ngorongoro crater": "ngorongoro-crater",
  ngorongoro: "ngorongoro-crater",
  "tarangire national park": "tarangire-national-park",
  tarangire: "tarangire-national-park",
  "mkomazi national park": "mkomazi-national-park",
  mkomazi: "mkomazi-national-park",
  "mount ol’doinyo lengai": "mount-oldoinyo-lengai",
  "mount oldoinyo lengai": "mount-oldoinyo-lengai",
  "ol doinyo lengai": "mount-oldoinyo-lengai",
  "oldoinyo lengai": "mount-oldoinyo-lengai",
  "lake natron": "lake-natron",
  "kondoa rock art sites": "kondoa-rock-art-sites",
  kondoa: "kondoa-rock-art-sites",
  "lake chala": "lake-chala",
  "lake jipe": "lake-jipe",
  "lake eyasi": "lake-eyasi",
  "pare mountains": "pare-mountains",
  "mount meru": "mount-meru",
  "ngurdoto crater": "ngurdoto-crater",
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
    await new Promise((r) => setTimeout(r, 900 * attempt));
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

  for (const m of html.matchAll(
    /(?:src|data-src|data-lazy-src|data-original|href)=["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi
  )) {
    push(m[1], name);
  }

  found.sort((a, b) => {
    const score = (u) =>
      (/\/images\/uploads\//i.test(u.src) ? 0 : 2) + (/logo|banner-ads|partner/i.test(u.src) ? 5 : 0);
    return score(a) - score(b);
  });
  return found;
}

function extractOverview(html) {
  const overviewMatch = html.match(/<h3[^>]*>\s*Overview\s*<\/h3>([\s\S]*?)(?=<h[23][^>]*>)/i);
  const block = overviewMatch ? overviewMatch[1] : "";
  const paragraphs = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((p) => p.length > 40)
    .filter((p) => !/cookie|subscribe|newsletter|cancel this reservation/i.test(p));
  if (paragraphs.length) return paragraphs.join("\n\n");
  return extractMeta(html, "description") || "";
}

function formatDuration(days, nights) {
  const dLabel = `${days} day${days === 1 ? "" : "s"}`;
  const nLabel = `${nights} night${nights === 1 ? "" : "s"}`;
  return { days, nights, label: `${dLabel} / ${nLabel}` };
}

function extractDuration(html, title) {
  const snap = stripTags(
    (html.match(/Duration:\s*([\s\S]{0,80}?Nights?)/i) || [])[0] || ""
  ).match(/(\d+)\s*Days?\s*\/\s*(\d+)\s*Nights?/i);
  if (snap) return formatDuration(Number(snap[1]), Number(snap[2]));
  if (/\bday\s*trip\b/i.test(title)) return { days: 1, nights: 0, label: "Day trip" };
  const range = title.match(/(\d+)\s*-\s*(\d+)\s*Days?/i);
  if (range) {
    const days = Number(range[2]);
    return { days, nights: Math.max(0, days - 1), label: `${range[1]}-${range[2]} days` };
  }
  const single = title.match(/(\d+)\s*Days?/i);
  if (single) return formatDuration(Number(single[1]), Math.max(0, Number(single[1]) - 1));
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
    .filter((label) => label && !/southern|eastern|northern|western|circuit/i.test(label));
  const ids = [];
  for (const label of labels) {
    const id = ACTIVITY_MAP[label.toLowerCase().trim()];
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
    if (
      new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`, "i").test(
        lower
      )
    ) {
      if (!hits.includes(slug)) hits.push(slug);
    }
  }
  return hits;
}

function extractDestinationIds(html, title, itinerary) {
  const slugs = new Set();
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
  const h3Idx = html.search(/<h3[^>]*>\s*Itinerary\s*<\/h3>/i);
  let block = "";
  if (h3Idx >= 0) {
    block = html.slice(h3Idx, h3Idx + 25000);
    const cut = block.search(/<h2[^>]*>|<h3[^>]*>\s*(?:Reviews|Destination|Relates)|Not sure\?/i);
    if (cut > 50) block = block.slice(0, cut);
  }
  if (!block) return [];

  const accordionItems = [
    ...block.matchAll(
      /accordion__icon[\s\S]*?>\s*<div[^>]*>\s*Day\s+(\d+)\s*<\/div>[\s\S]*?<div class="text-18[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?(?:ee-body[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>|accordion__content[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>)/gi
    ),
  ];

  const days = [];
  const seenDayNums = new Set();
  for (const m of accordionItems) {
    let dayNum = Number(m[1]);
    const title = stripTags(m[2]).replace(/\u00a0/g, " ").trim() || `Day ${dayNum}`;
    const summary = stripTags(m[3] || m[4] || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!summary || summary.length < 15) continue;
    if (seenDayNums.has(dayNum)) dayNum = Math.max(...seenDayNums) + 1;
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

function cleanPlace(value) {
  if (!value) return null;
  return (
    String(value)
      .replace(/\([^)]*\)/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s*\/\s*/g, " / ")
      .trim()
      .replace(/^[\s\-–—]+|[\s\-–—]+$/g, "") || null
  );
}

function extractStartEnd(itinerary) {
  const first = itinerary[0];
  const last = itinerary[itinerary.length - 1];
  let start = null;
  let end = null;
  if (first) {
    const parts = first.title.split(/\s*[–\-]\s*/);
    if (parts.length >= 2) start = parts[0].trim();
    else if (/arusha|moshi|dar/i.test(first.summary + first.title)) {
      if (/arusha/i.test(first.summary + first.title)) start = "Arusha";
      else if (/moshi/i.test(first.summary + first.title)) start = "Moshi";
      else start = "Dar es Salaam";
    }
  }
  if (last) {
    const parts = last.title.split(/\s*[–\-]\s*/);
    if (parts.length >= 2) end = parts[parts.length - 1].trim();
    else if (/arusha|moshi|dar/i.test(last.summary + last.title)) {
      if (/arusha/i.test(last.summary + last.title)) end = "Arusha";
      else if (/moshi/i.test(last.summary + last.title)) end = "Moshi";
      else end = "Dar es Salaam";
    }
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
  return items;
}

function introFrom(summary) {
  const first = String(summary || "")
    .split(/\n\s*\n/)[0]
    .trim();
  if (!first) return "";
  if (first.length <= 220) return first;
  return `${first.slice(0, 217).replace(/\s+\S*$/, "")}…`;
}

function hasNorthernSignal(html, title, fromDests) {
  const head = html.slice(0, 45000);
  if (/\/safaris\/category\/northern-circuit["'][^>]*>\s*Northern Circuit/i.test(head)) return true;
  if (/href=["'][^"']*northern-circuit[^"']*["'][^>]*>\s*Northern Circuit/i.test(head)) return true;
  if ((fromDests || []).some((d) => KNOWN_DEST_SLUGS.has(d))) return true;
  return resolveDestSlugFromText(title).length > 0;
}

function enrichActivities(pkg) {
  const blob = [pkg.title, pkg.summary, ...(pkg.itinerary || []).map((d) => `${d.title} ${d.summary}`)]
    .join(" ")
    .toLowerCase();
  const ids = new Set(pkg.activityIds || []);
  if (/game drive/.test(blob)) ids.add("activity-game-drives");
  if (/walk|hike|hiking|trek/.test(blob)) ids.add("activity-day-walk");
  if (/climb|kilimanjaro|meru|lengai|trekking/.test(blob)) ids.add("activity-trekking");
  if (/cultural|village|maasai|hadzabe|rock art/.test(blob)) ids.add("activity-cultural");
  if (/wildlife|lion|elephant|migration|buffalo|leopard|cheetah/.test(blob)) ids.add("activity-wildlife");
  if (/balloon/.test(blob)) ids.add("activity-wildlife");
  pkg.activityIds = [...ids];
  return pkg;
}

async function collectSafariSlugs() {
  const bySlug = new Map();
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
  return bySlug;
}

async function scrapePackage(slug, index, total, fromDests) {
  const url = `https://www.tanzaniatourism.com/safari/${slug}`;
  console.log(`[${index + 1}/${total}] ${slug}`);
  const html = await fetchText(url);
  const title = extractTitle(html) || slug.replace(/-/g, " ");

  if (!hasNorthernSignal(html, title, fromDests)) {
    return { skip: true, reason: "not-northern", slug, title };
  }

  const summary = extractOverview(html);
  let duration = extractDuration(html, title);
  const { labels: activityLabels, ids: activityIds } = extractActivities(html);
  const itinerary = extractItinerary(html);
  let destinationIds = extractDestinationIds(html, title, itinerary);
  const { startLocation, endLocation } = extractStartEnd(itinerary);
  const images = extractImages(html, title).filter((img) => /\/images\/uploads\//i.test(img.src));
  const fallbackImages = extractImages(html, title);
  const gallerySource = images.length >= IMAGE_COUNT ? images : fallbackImages;

  if (gallerySource.length < IMAGE_COUNT) {
    return { skip: true, reason: `images:${gallerySource.length}`, slug, title };
  }

  let days = itinerary;
  if (!days.length && duration.days === 1) {
    days = [
      {
        day: 1,
        title: title.replace(/^day\s*trip\s*(to\s*)?/i, "").trim() || "Day trip",
        summary: summary || "Day excursion as described in the overview.",
        destinationIds,
      },
    ];
  }
  if (!days.length && (duration.days || 0) > 1) {
    return { skip: true, reason: "no-itinerary", slug, title };
  }

  days = days.map((d, i) => ({ ...d, day: i + 1 }));

  if (days.length > 0 && duration.days != null && days.length !== duration.days) {
    const repairedDays = days.length;
    const repairedNights = Math.max(0, repairedDays - 1);
    duration =
      repairedDays === 1
        ? { days: 1, nights: 0, label: "Day trip" }
        : formatDuration(repairedDays, repairedNights);
  }

  if (!destinationIds.length && fromDests) {
    for (const d of fromDests) {
      if (KNOWN_DEST_SLUGS.has(d)) destinationIds.push(`dest-${d}`);
    }
  }
  if (!destinationIds.length) {
    return { skip: true, reason: "no-destination-ids", slug, title };
  }

  const hero = gallerySource[0];
  const gallery = gallerySource.slice(0, IMAGE_COUNT).map((img) => ({
    src: img.src,
    alt: img.alt || title,
    caption: null,
  }));

  const inclusions = extractListAfterHeading(html, "Included|Inclusions|What'?s Included");
  const exclusions = extractListAfterHeading(html, "Excluded|Exclusions|What'?s Not Included|Not Included");

  const cardSubtitleParts = [];
  if (duration.label) cardSubtitleParts.push(duration.label.replace(/\s*\/\s*/g, " · "));
  if (activityLabels[0]) cardSubtitleParts.push(activityLabels[0]);

  let pkg = {
    id: `pkg-${slug}`,
    slug,
    title,
    cardSubtitle: cardSubtitleParts.slice(0, 2).join(" · ") || "Northern circuit",
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
  };

  pkg = enrichActivities(pkg);
  return { skip: false, package: pkg };
}

function validationReport(packages, issues) {
  const report = {
    count: packages.length,
    targetCount: TARGET_COUNT,
    ok: packages.length >= TARGET_COUNT,
    packages: packages.map((pkg) => ({
      slug: pkg.slug,
      title: pkg.title,
      days: pkg.duration && pkg.duration.days,
      label: pkg.duration && pkg.duration.label,
      galleryCount: (pkg.gallery || []).length,
      itineraryDays: (pkg.itinerary || []).length,
      destinationIds: pkg.destinationIds,
      activityIds: pkg.activityIds,
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
    if ((pkg.gallery || []).length < IMAGE_COUNT) {
      report.corruptChecks.push({ slug: pkg.slug, error: `gallery < ${IMAGE_COUNT}` });
    }
    if (!pkg.heroImage || !pkg.heroImage.src) {
      report.corruptChecks.push({ slug: pkg.slug, error: "missing hero" });
    }
    if (!pkg.summary || pkg.summary.length < 20) {
      report.corruptChecks.push({ slug: pkg.slug, error: "weak summary" });
    }
    if (!(pkg.itinerary || []).length) {
      report.corruptChecks.push({ slug: pkg.slug, error: "empty itinerary" });
    }
    if (!(pkg.circuitIds || []).includes(CIRCUIT_ID)) {
      report.corruptChecks.push({ slug: pkg.slug, error: "missing northern circuit" });
    }
    const dayCount = pkg.duration && pkg.duration.days;
    const itinCount = (pkg.itinerary || []).length;
    if (dayCount != null && dayCount > 1 && itinCount !== dayCount) {
      report.corruptChecks.push({
        slug: pkg.slug,
        error: `itinerary length ${itinCount} != duration days ${dayCount}`,
      });
    }
  }

  report.clean = report.corruptChecks.length === 0 && issues.every((i) => i.level !== "error");
  return report;
}

async function main() {
  console.log("Collecting Northern Circuit safari URLs…");
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
          `  ok: ${result.package.duration.label || "?"} · itin ${result.package.itinerary.length} · imgs ${result.package.gallery.length}`
        );
      }
    } catch (err) {
      skipped.push({ slug, reason: err.message });
      console.error(`  FAIL: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 450));
  }

  const intermediatePath = path.join(root, "js/data/schemas/northern-packages.import.json");
  const intermediate = {
    _meta: {
      kind: "import-intermediate",
      version: 1,
      source: SOURCE_LISTING,
      note: "Northern Circuit safari packages scraped from Tanzania Tourism.",
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
  const report = validationReport(mapped.records.packages.length ? mapped.records.packages : packages, mapped.issues);
  report.packages = packages.map((pkg) => ({
    slug: pkg.slug,
    title: pkg.title,
    days: pkg.duration && pkg.duration.days,
    label: pkg.duration && pkg.duration.label,
    galleryCount: (pkg.gallery || []).length,
    itineraryDays: (pkg.itinerary || []).length,
    destinationIds: pkg.destinationIds,
    activityIds: pkg.activityIds,
    sourceUrl: pkg.sourceUrl,
  }));

  const reportPath = path.join(root, "js/data/schemas/northern-packages.validation.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("Wrote", reportPath);
  console.log("Map ok:", mapped.ok, "Clean:", report.clean, "Count:", packages.length);

  if (!mapped.ok || !report.clean || packages.length === 0) {
    console.error("Validation failed – production packages NOT updated.");
    console.error(JSON.stringify({ corruptChecks: report.corruptChecks, skipped: skipped.slice(0, 15) }, null, 2));
    process.exitCode = 1;
    return;
  }

  const productionItems = mapped.records.packages.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
    sourceUrl: packages[index] && packages[index].sourceUrl,
    batch: "northern",
  }));

  // Merge with existing production packages (keep southern / prior batches).
  const outPath = path.join(root, "js/data/production/packages.json");
  let existing = { items: [] };
  if (fs.existsSync(outPath)) {
    existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
  }
  const byId = new Map();
  for (const item of existing.items || []) {
    if (item && item.id) byId.set(item.id, item);
  }
  for (const item of productionItems) {
    byId.set(item.id, item);
  }

  // Southern first (no batch or batch!==northern), then northern — preserve relative order.
  const merged = [...byId.values()].sort((a, b) => {
    const aN = a.batch === "northern" || (a.circuitIds || []).includes("circuit-northern") ? 1 : 0;
    const bN = b.batch === "northern" || (b.circuitIds || []).includes("circuit-northern") ? 1 : 0;
    if (aN !== bN) return aN - bN;
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });

  // Re-number sortOrder globally for stable catalogue order.
  const numbered = merged.map((item, index) => ({ ...item, sortOrder: index + 1 }));

  const file = RamikaContentImport.toCollectionFile(
    "packages",
    numbered,
    "Safari packages: Southern corridor + Northern Circuit imports from tanzaniatourism.com. Pricing null until Ramika verifies rates."
  );
  fs.writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  console.log("Wrote", outPath, `(${numbered.length} total packages)`);

  console.log(
    JSON.stringify(
      {
        northernImported: packages.length,
        totalPackages: numbered.length,
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
