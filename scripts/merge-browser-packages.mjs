/**
 * Merge browser-extracted package JSON files into production/packages.json.
 * Usage: node scripts/merge-browser-packages.mjs path/to/batch.json
 * batch.json shape: { packages: [ ...packageRecords ] }
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const RamikaContentImport = require("../js/content/import/map.js");

const batchPath = process.argv[2];
if (!batchPath) {
  console.error("Usage: node scripts/merge-browser-packages.mjs <batch.json>");
  process.exit(1);
}

const batch = JSON.parse(fs.readFileSync(batchPath, "utf8"));
const rawPackages = (batch.packages || []).filter((p) => p && !p.error && p.slug);

const intermediate = {
  _meta: batch._meta || { kind: "import-intermediate", version: 1 },
  destinations: [],
  packages: rawPackages,
  circuits: [],
  activities: [],
};

const mapped = RamikaContentImport.mapImportDocument(intermediate, { origin: "production" });
console.log("Map ok:", mapped.ok, "issues:", mapped.issues.length);
if (!mapped.ok) {
  console.error(JSON.stringify(mapped.issues, null, 2));
  process.exit(1);
}

const outPath = path.join(root, "js/data/production/packages.json");
const existing = fs.existsSync(outPath)
  ? JSON.parse(fs.readFileSync(outPath, "utf8"))
  : { items: [] };

const byId = new Map();
for (const item of existing.items || []) {
  if (item?.id) byId.set(item.id, item);
}

const productionItems = mapped.records.packages.map((item, index) => ({
  ...item,
  sourceUrl: rawPackages[index]?.sourceUrl,
  batch: batch.batch || rawPackages[index]?.batch || undefined,
}));

for (const item of productionItems) {
  byId.set(item.id, item);
}

function circuitRank(item) {
  const ids = item.circuitIds || [];
  if (ids.includes("circuit-southern")) return 0;
  if (ids.includes("circuit-northern")) return 1;
  if (ids.includes("circuit-western")) return 2;
  if (ids.includes("circuit-zanzibar")) return 3;
  return 9;
}

const merged = [...byId.values()].sort((a, b) => {
  const rank = circuitRank(a) - circuitRank(b);
  if (rank !== 0) return rank;
  return String(a.slug).localeCompare(String(b.slug));
});

const numbered = merged.map((item, index) => ({ ...item, sortOrder: index + 1 }));
const file = RamikaContentImport.toCollectionFile(
  "packages",
  numbered,
  batch.note || "Merged safari packages from Tanzania Tourism imports."
);
fs.writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      mergedIn: productionItems.length,
      total: numbered.length,
      southern: numbered.filter((p) => (p.circuitIds || []).includes("circuit-southern")).length,
      northern: numbered.filter((p) => (p.circuitIds || []).includes("circuit-northern")).length,
      western: numbered.filter((p) => (p.circuitIds || []).includes("circuit-western")).length,
      zanzibar: numbered.filter((p) => (p.circuitIds || []).includes("circuit-zanzibar")).length,
      withPricing: numbered.filter((p) => p.pricing && p.pricing.amount != null).length,
    },
    null,
    2
  )
);
