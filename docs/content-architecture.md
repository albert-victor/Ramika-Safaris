# Content architecture – Ramika Safaris and Tours

Static JSON content layer for destinations, safari packages, circuits, activities, and reusable sections. Compatible with the existing HTML/CSS/vanilla JS site and `server.js` preview server. No CMS, database, or new framework.

## Separation of concerns

| Layer | Location | Role |
| --- | --- | --- |
| Presentation | `*.html`, `css/`, `js/home.js`, future page scripts | Layout and rendering only |
| Data access | `js/content/ramika-content.js` | Load, normalize, query, card projections |
| Production content | `js/data/production/*.json` | Real catalogue records |
| Development fixtures | `js/data/fixtures/*.json`, `js/data/home-fixtures.json` | Layout preview only |
| Import mapping | `js/content/import/map.js` | Intermediate format → internal schema |
| Config | `js/data/content.config.json` | Fixture enable/disable and paths |

## Data models

### Destination

Required: `id`, `slug`, `name`, `status`  
Optional: `intro`, `description`, `heroImage`, `gallery`, `region`, `circuitIds[]`, `activityIds[]`, `wildlifeHighlights[]`, `bestTimeToVisit`, `relatedPackageIds[]`, `seo`

- A destination may list **one or more** `circuitIds`. Do not assume exclusivity.
- `bestTimeToVisit` and `pricing`-like claims stay `null` until verified.
- `status`: `draft` | `published` | `archived`

### Safari package

Required: `id`, `slug`, `title`, `status`  
Optional: `summary`, `heroImage`, `gallery`, `duration` (`days`, `nights`, `label`), `startLocation`, `endLocation`, `circuitIds[]`, `destinationIds[]`, `activityIds[]`, `itinerary[]`, `accommodation`, `inclusions[]`, `exclusions[]`, `pricing`, `enquireCta`, `seo`

- Packages reference **multiple** destinations and activities by id.
- Incomplete itinerary days are dropped or repaired during normalization; import issues are reported.
- `pricing` is stored only when supplied; omit or null otherwise.

### Circuit / activity

Circuits and activities are shared taxonomies. Production already includes southern, northern, and western circuits plus wildlife / landscapes / on-the-road activities.

### Images

Internal shape:

```json
{ "src": "/images/... or https://...", "alt": "...", "caption": "optional" }
```

Relative site paths and absolute URLs are both accepted. Missing `src` drops the image.

## Data access (published vs preview)

```js
// Published catalogue – production only, status === published
const destinations = await RamikaContent.getDestinations();
const packages = await RamikaContent.getPackages();

// Layout preview – requires content.config.json includeDevelopmentFixtures: true
const preview = await RamikaContent.getDestinations({ mode: "preview", includeFixtures: true });

const dest = await RamikaContent.getDestinationBySlug("mikumi", { mode: "preview", includeFixtures: true });
```

Hard rules:

1. Published queries **never** return fixture records.
2. There is **no** silent fallback from empty production data to fixtures.
3. Preview/fixture access requires both the config flag and an explicit `includeFixtures` / `mode: "preview"` option.
4. Related-content helpers (`getRelatedPackagesForDestination`, `getRelatedDestinationsForPackage`) respect the same options.

## Demo-content lifecycle

1. During UI development, keep `"includeDevelopmentFixtures": true`.
2. Homepage section samples remain in `/js/data/home-fixtures.json` (kind: `development-fixtures`).
3. Catalogue layout samples live under `/js/data/fixtures/` with draft status and `fixture-` id prefixes.
4. After real content is imported into `/js/data/production/`:
   - Set `includeDevelopmentFixtures` to `false`.
   - Remove or empty fixture catalogue files when no longer needed.
   - Replace homepage fixtures with production `sections` when ready.
5. Navigation, search, related blocks, and public pages must call published APIs only.

## Import readiness

Expected intermediate document: `/js/data/schemas/expected-import.example.json`

Flow:

1. Write a **source-specific** adapter (not in-repo until the source format is known) that emits the intermediate document.
2. Call `RamikaContentImport.mapImportDocument(intermediate)`.
3. Inspect `issues` for duplicate ids/slugs, missing relationships, incomplete itineraries, and pricing gaps.
4. On `ok`, write collection files with `toCollectionFile(collection, items)` into `js/data/production/`.

The mapper accepts common field aliases (`title`/`name`, `hero`/`heroImage`, etc.) but does **not** assume Spreadsheet X, CMS Y, or any unknown vendor schema.

### Handling edge cases

| Case | Behaviour |
| --- | --- |
| Missing optional fields | Normalized to `null`, `[]`, or `""` |
| Duplicate ids/slugs in one batch | Reported as errors; import marked not ok |
| Production vs fixture id/slug clash | Production wins |
| Image path or URL | Kept as `src`; invalid/empty images dropped |
| Invalid itinerary rows | Skipped or repaired; warnings emitted |
| Draft vs published | Honoured via `status`; public queries use `published` only |
| Stable relationships | Ids preserved; unresolved references warn |

## Browser wiring

`partials/scripts.html` loads `/js/content/ramika-content.js` before page scripts. Optional import mapper: `/js/content/import/map.js` (after the content library).

## Verification

```bash
npm run verify:content
npm start
```

`verify:content` loads production and fixture JSON through the access layer and asserts published destination/package lists stay empty of fixtures.
