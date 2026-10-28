/**
 * Contact enquiry form – populates destination/package options from the catalogue
 * and preselects ?destination= / ?package= when present. Selections remain editable.
 */
(function () {
  const Content = window.RamikaContent;

  async function fillSelect(select, items, preferredSlug, labelFallback) {
    if (!select) return;
    const optionsBySlug = new Map();

    (items || []).forEach((item) => {
      if (!item?.slug) return;
      optionsBySlug.set(item.slug, item.name || item.title || item.slug);
    });

    if (preferredSlug && !optionsBySlug.has(preferredSlug) && labelFallback) {
      optionsBySlug.set(preferredSlug, labelFallback);
    }

    optionsBySlug.forEach((name, slug) => {
      const option = document.createElement("option");
      option.value = slug;
      option.textContent = name;
      select.appendChild(option);
    });

    if (preferredSlug) {
      if (![...select.options].some((option) => option.value === preferredSlug)) {
        const option = document.createElement("option");
        option.value = preferredSlug;
        option.textContent = labelFallback || preferredSlug;
        select.appendChild(option);
      }
      select.value = preferredSlug;
    }
  }

  async function loadCatalogueOptions(preferredDestination, preferredPackage) {
    if (!Content) return { packageTitle: null };

    const availability = await Content.getFixtureAvailability();
    const previewOpts =
      availability.includeDevelopmentFixtures
        ? { mode: "preview", includeFixtures: true }
        : null;

    let destinations = await Content.getDestinations();
    let packages = await Content.getPackages();

    let destinationLabel = null;
    let packageTitle = null;

    if (preferredDestination) {
      let match = destinations.find((item) => item.slug === preferredDestination);
      if (!match && previewOpts) {
        match = await Content.getDestinationBySlug(preferredDestination, previewOpts);
        if (match && !destinations.some((item) => item.slug === match.slug)) {
          destinations = destinations.concat(match);
        }
      }
      destinationLabel = match?.name || preferredDestination;
    }

    if (preferredPackage) {
      let match = packages.find((item) => item.slug === preferredPackage);
      if (!match && previewOpts) {
        match = await Content.getPackageBySlug(preferredPackage, previewOpts);
        if (match && !packages.some((item) => item.slug === match.slug)) {
          packages = packages.concat(match);
        }
      }
      packageTitle = match?.title || preferredPackage;

      // If package has destinations and no destination was chosen, offer the package destinations.
      if (match && previewOpts) {
        const related = await Content.getRelatedDestinationsForPackage(match, previewOpts);
        related.forEach((dest) => {
          if (!destinations.some((item) => item.slug === dest.slug)) destinations.push(dest);
        });
        if (!preferredDestination && related[0]?.slug) {
          preferredDestination = related[0].slug;
          destinationLabel = related[0].name;
        }
      }
    }

    await fillSelect(
      document.querySelector("[data-enquire-destination]"),
      destinations.map((item) => ({ slug: item.slug, name: item.name })),
      preferredDestination,
      destinationLabel
    );

    await fillSelect(
      document.querySelector("[data-enquire-package]"),
      packages.map((item) => ({ slug: item.slug, name: item.title })),
      preferredPackage,
      packageTitle
    );

    return { packageTitle, preferredDestination };
  }

  async function init() {
    if (document.body.dataset.page !== "contact") return;

    const form = document.querySelector("[data-enquire-form]");
    const note = document.querySelector("[data-enquire-note]");
    const message = document.querySelector("[data-enquire-message]");
    const params = new URLSearchParams(window.location.search);
    const preferredDestination = (params.get("destination") || "").trim();
    const preferredPackage = (params.get("package") || "").trim();

    const loaded = await loadCatalogueOptions(preferredDestination, preferredPackage);

    if (message && preferredPackage && !message.value) {
      const title = loaded.packageTitle || preferredPackage;
      message.value = `I am interested in the "${title}" safari package. Please advise on dates, lodging standards, and next steps.`;
    }

    if (!form) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (note) {
        note.hidden = false;
        note.textContent =
          "Thank you. Enquiry delivery is not connected on this preview site yet – please keep a copy of your message and use the published contact details once they are available.";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
