/**
 * Validate production destinations for broken / false import data.
 * Usage: node scripts/validate-destinations.mjs [circuit-northern|circuit-southern|all]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const RamikaContent = require("../js/content/ramika-content.js");

RamikaContent.setNodeIO(fs, root);
RamikaContent.clearCaches();

const filterArg = process.argv[2] || "circuit-northern";

async function headOk(url, attempt = 1) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  };
  try {
    const get = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { ...headers, Range: "bytes=0-1023" },
    });
    if (get.ok || get.status === 206) return { ok: true, status: get.status };
    const full = await fetch(url, { method: "GET", redirect: "follow", headers });
    if (full.ok || full.status === 206) return { ok: true, status: full.status };
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
      return headOk(url, attempt + 1);
    }
    return { ok: false, status: full.status };
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
      return headOk(url, attempt + 1);
    }
    return { ok: false, status: 0, error: err.message };
  }
}

function pushIssue(issues, level, slug, message) {
  issues.push({ level, slug, message });
}

async function main() {
  const file = JSON.parse(
    fs.readFileSync(path.join(root, "js/data/production/destinations.json"), "utf8")
  );
  let items = file.items || [];
  if (filterArg !== "all") {
    items = items.filter((item) => (item.circuitIds || []).includes(filterArg));
  }

  const published = await RamikaContent.getDestinations();
  const publishedSlugs = new Set(published.map((d) => d.slug));
  const circuits = await RamikaContent.getCircuits();
  const circuitIds = new Set(circuits.map((c) => c.id));
  const activities = await RamikaContent.getActivities();
  const activityIds = new Set(activities.map((a) => a.id));

  const issues = [];
  const ids = new Set();
  const slugs = new Set();

  console.log(`Validating ${items.length} destination(s) [${filterArg}]…\n`);

  for (const raw of items) {
    const item = RamikaContent.normalize.destination(raw, "production");
    if (!item) {
      pushIssue(issues, "error", raw && raw.slug, "Failed normalization");
      continue;
    }

    if (ids.has(item.id)) pushIssue(issues, "error", item.slug, `Duplicate id ${item.id}`);
    if (slugs.has(item.slug)) pushIssue(issues, "error", item.slug, `Duplicate slug`);
    ids.add(item.id);
    slugs.add(item.slug);

    if (item.status !== "published") {
      pushIssue(issues, "error", item.slug, `Expected published, got ${item.status}`);
    }
    if (!item.intro || item.intro.length < 40) {
      pushIssue(issues, "error", item.slug, "Missing/short intro");
    }
    if (!item.description || item.description.length < 120) {
      pushIssue(issues, "error", item.slug, "Missing/short description");
    }
    if (!item.heroImage || !item.heroImage.src) {
      pushIssue(issues, "error", item.slug, "Missing hero image");
    }
    if (!item.gallery || item.gallery.length !== 5) {
      pushIssue(issues, "error", item.slug, `Gallery must be 5 images (got ${(item.gallery || []).length})`);
    }
    const gallerySrcs = new Set((item.gallery || []).map((g) => g.src));
    if (gallerySrcs.size !== (item.gallery || []).length) {
      pushIssue(issues, "error", item.slug, "Duplicate gallery image URLs");
    }
    for (const id of item.circuitIds || []) {
      if (!circuitIds.has(id)) pushIssue(issues, "error", item.slug, `Unknown circuitId ${id}`);
    }
    for (const id of item.activityIds || []) {
      if (!activityIds.has(id)) pushIssue(issues, "error", item.slug, `Unknown activityId ${id}`);
    }
    if (!publishedSlugs.has(item.slug)) {
      pushIssue(issues, "error", item.slug, "Not returned by published getDestinations()");
    }

    // Soft checks for false/noisy data
    if (/undefined|null|lorem ipsum|fixture|preview only/i.test(`${item.intro}\n${item.description}`)) {
      pushIssue(issues, "error", item.slug, "Suspicious placeholder copy");
    }
    if (/serengeti/i.test(item.name) && !/serengeti/i.test(item.slug)) {
      pushIssue(issues, "error", item.slug, "Soft-404 mismatch: title is Serengeti for non-Serengeti slug");
    }
    const slugToken = String(item.slug || "").split("-").find((t) => t.length > 4);
    if (slugToken && !new RegExp(slugToken, "i").test(`${item.name} ${item.intro}`)) {
      pushIssue(issues, "warning", item.slug, `Name/intro may not mention key slug token "${slugToken}"`);
    }
    if (item.bestTimeToVisit && item.bestTimeToVisit.length > 120) {
      pushIssue(issues, "warning", item.slug, "bestTimeToVisit looks noisy/long");
    }

    // Image reachability (hero + gallery)
    const urls = [item.heroImage.src, ...(item.gallery || []).map((g) => g.src)].filter(Boolean);
    const uniqueUrls = [...new Set(urls)];
    for (const url of uniqueUrls) {
      if (!/^https:\/\/www\.tanzaniatourism\.com\/images\/uploads\//i.test(url)) {
        pushIssue(issues, "warning", item.slug, `Non-upload image URL: ${url}`);
      }
      const check = await headOk(url);
      if (!check.ok) {
        pushIssue(
          issues,
          "error",
          item.slug,
          `Broken image (${check.status || check.error}): ${url.split("/").pop()}`
        );
      }
      await new Promise((r) => setTimeout(r, 80));
    }

    console.log(
      `✓ ${item.sortOrder || "-"} ${item.name} | gallery ${item.gallery.length} | desc ${item.description.length}c | wildlife ${(item.wildlifeHighlights || []).length}`
    );
  }

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  console.log("\n--- Validation summary ---");
  console.log(`Checked: ${items.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  if (issues.length) {
    for (const issue of issues) {
      console.log(`[${issue.level}] ${issue.slug}: ${issue.message}`);
    }
  } else {
    console.log("No broken or false import issues found.");
  }

  if (errors.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
