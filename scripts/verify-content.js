/**
 * Smoke-check the content architecture without a browser.
 * Usage: node scripts/verify-content.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RamikaContent = require("../js/content/ramika-content.js");
const RamikaContentImport = require("../js/content/import/map.js");

RamikaContent.setNodeIO(fs, ROOT);
RamikaContent.clearCaches();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const config = await RamikaContent.loadConfig();
  assert(config.paths && config.paths.production, "content config missing production paths");

  const publishedDestinations = await RamikaContent.getDestinations();
  const publishedPackages = await RamikaContent.getPackages();
  const publishedCircuits = await RamikaContent.getCircuits();
  const publishedActivities = await RamikaContent.getActivities();

  assert(
    publishedDestinations.every((item) => !item.isFixture && item.contentOrigin === "production"),
    "Published destinations must never include fixtures"
  );
  assert(
    publishedPackages.every((item) => !item.isFixture && item.contentOrigin === "production"),
    "Published packages must never include fixtures"
  );
  assert(publishedCircuits.length >= 3, "Expected seeded production circuits");
  assert(publishedActivities.length >= 3, "Expected seeded production activities");

  if (config.includeDevelopmentFixtures) {
    const previewDestinations = await RamikaContent.getDestinations({
      mode: "preview",
      includeFixtures: true,
    });
    const previewPackages = await RamikaContent.getPackages({
      mode: "preview",
      includeFixtures: true,
    });
    assert(previewDestinations.some((item) => item.isFixture), "Preview should expose fixture destinations when enabled");
    assert(previewPackages.some((item) => item.isFixture), "Preview should expose fixture packages when enabled");

    // Without explicit preview flags, fixtures must stay hidden even if config allows them.
    assert(
      publishedDestinations.every((item) => !item.isFixture),
      "Published destination queries must never return fixtures"
    );
    assert(
      publishedPackages.every((item) => !item.isFixture),
      "Published package queries must never return fixtures"
    );
    assert(
      publishedDestinations.length >= 13,
      "Expected Southern Circuit destinations in production after import"
    );
  }

  const examplePath = path.join(ROOT, "js/data/schemas/expected-import.example.json");
  const example = JSON.parse(fs.readFileSync(examplePath, "utf8"));
  const mapped = RamikaContentImport.mapImportDocument(example);
  assert(mapped.ok, `Example import should map cleanly: ${JSON.stringify(mapped.issues, null, 2)}`);
  assert(mapped.records.destinations.length === 1, "Example destination missing after map");
  assert(mapped.records.packages.length === 1, "Example package missing after map");

  const home = await RamikaContent.getHomePageFixtures();
  if (config.includeDevelopmentFixtures) {
    assert(home && home._meta && home._meta.kind === "development-fixtures", "Homepage fixtures should load while enabled");
  }

  console.log("Content architecture verification passed.");
  console.log(
    JSON.stringify(
      {
        published: {
          destinations: publishedDestinations.length,
          packages: publishedPackages.length,
          circuits: publishedCircuits.length,
          activities: publishedActivities.length,
        },
        fixturesEnabled: Boolean(config.includeDevelopmentFixtures),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
