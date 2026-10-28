/**
 * Run inside TT origin via CDP Runtime.evaluate (awaitPromise: true).
 * Expects window.__RAMIKA_BATCH__ = { circuit, destSlugs, urls: string[] }
 */
(async () => {
  const cfg = window.__RAMIKA_BATCH__ || {};
  const CIRCUIT = cfg.circuit || "circuit-southern";
  const KNOWN = new Set(cfg.destSlugs || []);
  const urls = cfg.urls || [];

  const strip = (html) =>
    String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

  function extract(doc, pageUrl) {
    const title =
      (doc.querySelector("h1") && doc.querySelector("h1").textContent.trim()) ||
      (doc.querySelector("title") && doc.querySelector("title").textContent.split("|")[0].trim()) ||
      "";
    const slug = pageUrl.replace(/^https?:\/\/[^/]+\/safari\//, "").replace(/\/$/, "");

    const overviewEl = [...doc.querySelectorAll("h3")].find((h) => /overview/i.test(h.textContent));
    let summary = "";
    if (overviewEl) {
      let n = overviewEl.nextElementSibling;
      const parts = [];
      while (n && n.tagName !== "H3" && n.tagName !== "H2") {
        if (n.tagName === "P") parts.push(strip(n.innerHTML));
        n.querySelectorAll?.("p").forEach((p) => parts.push(strip(p.innerHTML)));
        n = n.nextElementSibling;
      }
      summary = parts.filter((p) => p.length > 40).join("\n\n");
    }
    if (!summary) {
      const meta = doc.querySelector('meta[name="description"]');
      summary = (meta && meta.getAttribute("content")) || "";
    }

    const bodyText = doc.body ? doc.body.textContent : "";
    const durText = bodyText.match(/Duration:\s*(\d+)\s*Days?\s*\/\s*(\d+)\s*Nights?/i);
    let duration;
    if (durText) {
      const days = Number(durText[1]);
      const nights = Number(durText[2]);
      duration = {
        days,
        nights,
        label: `${days} day${days === 1 ? "" : "s"} / ${nights} night${nights === 1 ? "" : "s"}`,
      };
    } else if (/day\s*trip/i.test(title)) {
      duration = { days: 1, nights: 0, label: "Day trip" };
    } else {
      const m = title.match(/(\d+)\s*Days?/i);
      if (m) {
        const days = Number(m[1]);
        duration = {
          days,
          nights: Math.max(0, days - 1),
          label: `${days} day${days === 1 ? "" : "s"} / ${Math.max(0, days - 1)} night${
            Math.max(0, days - 1) === 1 ? "" : "s"
          }`,
        };
      } else duration = { days: null, nights: null, label: null };
    }

    const days = [];
    doc.querySelectorAll(".accordion__item").forEach((item) => {
      const dayLabel = (item.querySelector(".accordion__icon") && item.querySelector(".accordion__icon").textContent) || "";
      const dayMatch = dayLabel.match(/Day\s+(\d+)/i);
      if (!dayMatch) return;
      const dayTitle =
        (item.querySelector(".text-18") &&
          item.querySelector(".text-18").textContent.replace(/\u00a0/g, " ").trim()) ||
        `Day ${dayMatch[1]}`;
      const bodyEl = item.querySelector(".ee-body, .accordion__content");
      const daySummary = strip(bodyEl ? bodyEl.innerHTML : "");
      if (daySummary.length < 15) return;
      days.push({ day: Number(dayMatch[1]), title: dayTitle, summary: daySummary, destinationIds: [] });
    });
    const seen = new Set();
    days.forEach((d) => {
      if (seen.has(d.day)) d.day = Math.max(...seen) + 1;
      seen.add(d.day);
    });
    days.sort((a, b) => a.day - b.day);
    days.forEach((d, i) => {
      d.day = i + 1;
    });

    if (days.length && duration && duration.days && days.length !== duration.days) {
      const d = days.length;
      const n = Math.max(0, d - 1);
      duration = {
        days: d,
        nights: n,
        label: d === 1 ? "Day trip" : `${d} days / ${n} night${n === 1 ? "" : "s"}`,
      };
    }

    if (!days.length && duration && duration.days === 1) {
      days.push({
        day: 1,
        title: title.replace(/^day\s*trip\s*(to\s*)?/i, "").trim() || "Day trip",
        summary: summary || "Day excursion.",
        destinationIds: [],
      });
    }

    const imgs = [];
    const seenImg = new Set();
    const pushImg = (src, alt) => {
      if (!src || !/\.(jpe?g|png|webp)/i.test(src)) return;
      if (/logo|icon|favicon|sprite|flag/i.test(src)) return;
      let url = src.startsWith("//")
        ? `https:${src}`
        : src.startsWith("/")
          ? `https://www.tanzaniatourism.com${src}`
          : src;
      url = url.replace(
        /\/images\/made\/images\/uploads\/(.+?)_\d+_\d+(?:shar-\d+)?(?:brig-\d+)?(?:_c\d+)?(\.(?:jpe?g|png|webp))/i,
        "/images/uploads/$1$2"
      );
      if (/\/images\/made\//i.test(url)) return;
      const key = url.split("/").pop().toLowerCase().replace(/_\d+_\d+.*/, "");
      if (seenImg.has(key)) return;
      seenImg.add(key);
      imgs.push({ src: url, alt: alt || title });
    };
    const og = doc.querySelector('meta[property="og:image"]');
    if (og) pushImg(og.getAttribute("content"), title);
    doc.querySelectorAll("img[src], a[href*='.jpg'], a[href*='.jpeg'], a[href*='.png']").forEach((el) => {
      pushImg(el.getAttribute("src") || el.getAttribute("href"), el.getAttribute("alt") || title);
    });

    const destIds = new Set();
    const destSection = [...doc.querySelectorAll("h2")].find((h) => /destination/i.test(h.textContent));
    if (destSection && destSection.parentElement) {
      destSection.parentElement.querySelectorAll('a[href*="/destination/"]').forEach((a) => {
        const m = a.getAttribute("href").match(/\/destination\/([a-z0-9-]+)/i);
        if (m && (!KNOWN.size || KNOWN.has(m[1]))) destIds.add(`dest-${m[1]}`);
      });
    }
    const lower = title.toLowerCase();
    KNOWN.forEach((s) => {
      const name = s.replace(/-/g, " ");
      if (lower.includes(name) || lower.includes(s.split("-")[0])) destIds.add(`dest-${s}`);
    });

    const activityIds = new Set(["activity-wildlife"]);
    const blob = `${title} ${summary} ${days.map((d) => d.summary).join(" ")}`.toLowerCase();
    if (/game drive/.test(blob)) activityIds.add("activity-game-drives");
    if (/walk|hik|trek/.test(blob)) activityIds.add("activity-day-walk");
    if (/climb|kilimanjaro|meru|lengai/.test(blob)) activityIds.add("activity-trekking");
    if (/cultural|maasai|village|rock art/.test(blob)) activityIds.add("activity-cultural");

    if (imgs.length < 2) return { error: "images", slug, title, count: imgs.length };
    if (!days.length) return { error: "no-itinerary", slug, title };

    const gallery = imgs.slice(0, 2).map((img) => ({ src: img.src, alt: img.alt, caption: null }));
    const start =
      (days[0] && days[0].title.split(/\s*[–\-]\s*/)[0] && days[0].title.split(/\s*[–\-]\s*/)[0].trim()) ||
      null;
    const last = days[days.length - 1];
    const endParts = (last && last.title.split(/\s*[–\-]\s*/)) || [];
    const end = endParts.length >= 2 ? endParts[endParts.length - 1].trim() : start;

    return {
      id: `pkg-${slug}`,
      slug,
      title,
      cardSubtitle: duration.label ? duration.label.replace(/\s*\/\s*/g, " · ") : null,
      summary,
      heroImage: { src: gallery[0].src, alt: gallery[0].alt },
      gallery,
      duration,
      startLocation: start,
      endLocation: end,
      circuitIds: [CIRCUIT],
      destinationIds: [...destIds],
      activityIds: [...activityIds],
      itinerary: days,
      accommodation:
        "Lodging reserved to the standard you name (lodge or campsite as available on the route). Lodges are not owned by Ramika.",
      inclusions: [
        "Licensed safari vehicle",
        "Professional guide",
        "Meals as stated in the final itinerary",
        "Park activities as listed",
      ],
      exclusions: ["Park entrance fees", "Flights", "Personal expenses", "Tips", "Travel insurance"],
      pricing: null,
      enquireCta: { label: "Enquire about this safari", href: "/contact.html#enquire" },
      seo: { title: `${title} · Ramika Safaris and Tours`, description: summary.slice(0, 160) },
      status: "published",
      sourceUrl: pageUrl,
    };
  }

  const out = [];
  for (const url of urls) {
    try {
      const html = await fetch(url, { credentials: "omit" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      });
      const doc = new DOMParser().parseFromString(html, "text/html");
      out.push(extract(doc, url));
    } catch (err) {
      out.push({ error: String(err && err.message ? err.message : err), url });
    }
  }
  return out;
})();
