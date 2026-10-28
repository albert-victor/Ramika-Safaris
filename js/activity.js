/**
 * Activity detail – destinations and packages related to one activity.
 */
(function () {
  const Content = window.RamikaContent;
  const Cards = window.RamikaCards;

  const els = {
    loading: document.querySelector("[data-activity-loading]"),
    notFound: document.querySelector("[data-activity-notfound]"),
    content: document.querySelector("[data-activity-content]"),
    hero: document.querySelector("[data-activity-hero]"),
    heroImage: document.querySelector("[data-activity-hero-image]"),
    heroCopy: document.querySelector("[data-activity-hero-copy]"),
    heading: document.querySelector("[data-activity-heading]"),
    lede: document.querySelector("[data-activity-lede]"),
    destSection: document.querySelector("[data-activity-destinations-section]"),
    destGrid: document.querySelector("[data-activity-destinations]"),
    destStatus: document.querySelector("[data-activity-dest-status]"),
    grid: document.querySelector("[data-activity-packages]"),
    gridStatus: document.querySelector("[data-activity-grid-status]"),
    empty: document.querySelector("[data-activity-empty]"),
    robots: document.querySelector("[data-activity-robots]"),
  };

  function readQuery() {
    const params = new URLSearchParams(window.location.search);
    return {
      slug: params.get("slug") || "",
      preview: params.get("preview") === "1",
    };
  }

  function showNotFound() {
    document.body.classList.remove("has-hero");
    if (els.loading) els.loading.hidden = true;
    if (els.hero) els.hero.hidden = true;
    if (els.content) els.content.hidden = true;
    if (els.notFound) els.notFound.hidden = false;
  }

  function renderHero(activity) {
    if (!els.hero || !els.heroCopy) return;
    const image = activity.image || {};
    if (els.heroImage && image.src) {
      els.heroImage.src = image.src;
      els.heroImage.alt = image.alt || "";
      els.heroImage.hidden = false;
    }
    const escape = Cards ? Cards.escapeHtml : (v) => String(v ?? "");
    els.heroCopy.innerHTML = `
      <p class="script">In the field</p>
      <h1>${escape(activity.name)}</h1>
    `;
    els.hero.hidden = false;
    document.body.classList.add("has-hero");
  }

  function observeReveals(root) {
    if (window.RamikaMotion) {
      if (typeof window.RamikaMotion.refresh === "function") {
        window.RamikaMotion.refresh();
      } else if (root && typeof window.RamikaMotion.observe === "function") {
        window.RamikaMotion.observe(root);
      }
      return;
    }
    (root || document).querySelectorAll?.(".reveal, .media-reveal").forEach((node) => {
      node.classList.add("is-visible");
    });
  }

  async function init() {
    if (!Content) {
      showNotFound();
      return;
    }

    const { slug, preview } = readQuery();
    const options = preview ? { mode: "preview", includeFixtures: true } : {};

    if (!slug) {
      showNotFound();
      return;
    }

    try {
      const activity = await Content.getActivityBySlug(slug, options);
      if (!activity) {
        showNotFound();
        return;
      }

      document.title = `${activity.name} · Ramika Safaris and Tours`;
      const desc = document.querySelector('meta[name="description"]');
      if (desc && activity.summary) desc.setAttribute("content", activity.summary);
      if (els.robots && activity.status === "published" && !activity.isFixture) {
        els.robots.setAttribute("content", "index,follow");
      }

      renderHero(activity);
      if (els.heading) els.heading.textContent = activity.name;
      if (els.lede) els.lede.textContent = activity.summary || "";

      let packages = await Content.getPackages({ ...options, activityId: activity.id });
      let destinations = await Content.getDestinations({ ...options, activityId: activity.id });
      let usePreviewCards = preview;

      if ((!packages.length || !destinations.length) && !preview) {
        const availability = await Content.getFixtureAvailability();
        if (availability && availability.includeDevelopmentFixtures) {
          if (!packages.length) {
            packages = await Content.getPackages({
              mode: "preview",
              includeFixtures: true,
              activityId: activity.id,
            });
          }
          if (!destinations.length) {
            destinations = await Content.getDestinations({
              mode: "preview",
              includeFixtures: true,
              activityId: activity.id,
            });
          }
          usePreviewCards = true;
        }
      }

      const lookupOptions = usePreviewCards
        ? { mode: "preview", includeFixtures: true }
        : options;
      const [circuits, allDestinations, activities] = await Promise.all([
        Content.getCircuits(lookupOptions),
        Content.getDestinations(lookupOptions),
        Content.getActivities(lookupOptions),
      ]);

      const circuitsById = Object.fromEntries((circuits || []).map((item) => [item.id, item]));
      const destinationsById = Object.fromEntries(
        (allDestinations || []).map((item) => [item.id, item])
      );
      const activitiesById = Object.fromEntries((activities || []).map((item) => [item.id, item]));

      if (els.loading) {
        els.loading.hidden = true;
        els.loading.setAttribute("aria-hidden", "true");
      }
      if (els.notFound) {
        els.notFound.hidden = true;
        els.notFound.setAttribute("aria-hidden", "true");
      }
      if (els.content) {
        els.content.hidden = false;
        els.content.removeAttribute("aria-hidden");
      }

      if (els.destSection && els.destGrid) {
        if (destinations.length && Cards) {
          els.destSection.hidden = false;
          if (els.destStatus) {
            els.destStatus.textContent = `${destinations.length} destination${
              destinations.length === 1 ? "" : "s"
            }`;
          }
          els.destGrid.innerHTML = destinations
            .map((item) =>
              Cards.destinationCard(item, {
                circuitsById,
                activitiesById,
                preview: usePreviewCards,
              })
            )
            .join("");
        } else {
          els.destSection.hidden = true;
          els.destGrid.innerHTML = "";
        }
      }

      if (!packages.length) {
        if (els.grid) els.grid.innerHTML = "";
        if (els.empty) els.empty.hidden = false;
        if (els.gridStatus) els.gridStatus.textContent = "";
      } else {
        if (els.empty) els.empty.hidden = true;
        if (els.gridStatus) {
          els.gridStatus.textContent = `${packages.length} package${
            packages.length === 1 ? "" : "s"
          }`;
        }
        if (els.grid && Cards) {
          els.grid.innerHTML = packages
            .map((item) =>
              Cards.packageCard(item, {
                circuitsById,
                destinationsById,
                activitiesById,
                preview: usePreviewCards,
              })
            )
            .join("");
        }
      }

      observeReveals(els.content);
    } catch (error) {
      console.error(error);
      showNotFound();
    }
  }

  init();
})();
