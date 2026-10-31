/**
 * Download remote image URLs from production JSON into /images/imported
 * and rewrite src fields to local paths.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "images", "imported");
const FILES = [
  "js/data/production/destinations.json",
  "js/data/production/packages.json",
  "js/data/production/activities.json",
  "js/data/production/circuits.json",
].map((rel) => path.join(ROOT, rel));

const CONCURRENCY = 8;
const mapPath = path.join(OUT_DIR, "_url-map.json");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function extFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext)) return ext;
  } catch (_) {
    /* ignore */
  }
  return ".jpg";
}

function localNameFor(url) {
  const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 12);
  let base = "image";
  try {
    base = path.basename(new URL(url).pathname) || "image";
  } catch (_) {
    /* ignore */
  }
  base = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  if (!base) base = "image";
  const ext = extFromUrl(url);
  if (!path.extname(base)) base += ext;
  return `${hash}-${base}`;
}

function collectRemoteSrcs(node, set = new Set()) {
  if (!node || typeof node !== "object") return set;
  if (typeof node.src === "string" && /^https?:\/\//i.test(node.src)) {
    set.add(node.src);
  }
  if (Array.isArray(node)) node.forEach((item) => collectRemoteSrcs(item, set));
  else Object.values(node).forEach((value) => collectRemoteSrcs(value, set));
  return set;
}

function rewriteSrcs(node, urlMap) {
  if (!node || typeof node !== "object") return 0;
  let changed = 0;
  if (typeof node.src === "string" && urlMap[node.src]) {
    node.src = urlMap[node.src];
    changed += 1;
  }
  if (Array.isArray(node)) {
    for (const item of node) changed += rewriteSrcs(item, urlMap);
  } else {
    for (const value of Object.values(node)) changed += rewriteSrcs(value, urlMap);
  }
  return changed;
}

async function downloadOne(url, destFile) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: new URL(url).origin + "/",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 200) {
    throw new Error(`tiny file (${buffer.length} bytes)`);
  }
  fs.writeFileSync(destFile, buffer);
  return buffer.length;
}

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function next() {
    const i = index++;
    if (i >= items.length) return;
    results[i] = await worker(items[i], i);
    await next();
  }
  const starters = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(starters);
  return results;
}

async function main() {
  ensureDir(OUT_DIR);

  const urlMap = fs.existsSync(mapPath)
    ? JSON.parse(fs.readFileSync(mapPath, "utf8"))
    : {};

  const remote = new Set();
  for (const file of FILES) {
    if (!fs.existsSync(file)) continue;
    collectRemoteSrcs(JSON.parse(fs.readFileSync(file, "utf8")), remote);
  }

  const urls = [...remote];
  console.log(`Found ${urls.length} unique remote image URLs`);

  const pending = urls.filter((url) => {
    const mapped = urlMap[url];
    if (mapped) {
      const abs = path.join(ROOT, mapped.replace(/^\//, "").replace(/\//g, path.sep));
      if (fs.existsSync(abs) && fs.statSync(abs).size > 200) return false;
    }
    return true;
  });

  console.log(`Downloading ${pending.length} (skipping ${urls.length - pending.length} already local)`);

  let ok = 0;
  let fail = 0;
  const failures = [];

  await runPool(pending, CONCURRENCY, async (url) => {
    const name = localNameFor(url);
    const abs = path.join(OUT_DIR, name);
    const webPath = `/images/imported/${name}`;
    try {
      const size = await downloadOne(url, abs);
      urlMap[url] = webPath;
      ok += 1;
      process.stdout.write(`OK ${ok}/${pending.length} ${name} (${size}b)\n`);
    } catch (error) {
      fail += 1;
      failures.push({ url, error: String(error.message || error) });
      process.stdout.write(`FAIL ${url} -> ${error.message || error}\n`);
    }
  });

  fs.writeFileSync(mapPath, JSON.stringify(urlMap, null, 2));

  let rewritten = 0;
  for (const file of FILES) {
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const count = rewriteSrcs(data, urlMap);
    if (count) {
      fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
      rewritten += count;
      console.log(`Rewrote ${count} src in ${path.relative(ROOT, file)}`);
    }
  }

  // Final audit
  const leftover = new Set();
  for (const file of FILES) {
    if (!fs.existsSync(file)) continue;
    collectRemoteSrcs(JSON.parse(fs.readFileSync(file, "utf8")), leftover);
  }

  console.log("\nDone.");
  console.log({ downloaded: ok, failed: fail, rewritten, leftoverRemote: leftover.size });
  if (failures.length) {
    fs.writeFileSync(
      path.join(OUT_DIR, "_failures.json"),
      JSON.stringify(failures, null, 2)
    );
    console.log(`Wrote ${failures.length} failures to images/imported/_failures.json`);
  }
  if (leftover.size) {
    console.log("Still remote:");
    [...leftover].slice(0, 20).forEach((u) => console.log(" ", u));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
