/**
 * Circuit detail – destinations belonging to one safari circuit.
 */
(function () {
  const Content = window.RamikaContent;
  const Cards = window.RamikaCards;

  const els = {
    loading: document.querySelector("[data-circuit-loading]"),
    notFound: document.querySelector("[data-circuit-notfound]"),
    content: document.querySelector("[data-circuit-content]"),
    hero: document.querySelector("[data-circuit-hero]"),
    heroImage: document.querySelector("[data-circuit-hero-image]"),
    heroCopy: document.querySelector("[data-circuit-hero-copy]"),
    lede: document.querySelector("[data-circuit-lede]"),
    grid: document.querySelector("[data-circuit-destinations]"),
    gridStatus: document.querySelector("[data-circuit-grid-status]"),
    empty: document.querySelector("[data-circuit-empty]"),
    robots: document.querySelector("[data-circuit-robots]"),
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

  const FALLBACK_HERO = {
    src: "/images/about_Activities/mikumi_experieces.jpg",
    alt: "Zebras in tall grass on a Tanzania safari.",
  };

  function renderHero(circuit) {
    if (!els.hero || !els.heroCopy) return;
    const image = circuit.heroImage || {};
    const src = image.src || FALLBACK_HERO.src;
    const alt = image.alt || FALLBACK_HERO.alt;
    if (els.heroImage) {
      els.heroImage.src = src;
      els.heroImage.alt = alt;
      els.heroImage.hidden = false;
    }
    const summary = circuit.summary || "";
    const ledeHtml = summary
      ? `<p class="hero-lede">${Cards ? Cards.escapeHtml(summary) : summary}</p>`
      : "";
    els.heroCopy.innerHTML = `
      <p class="script">${Cards ? Cards.escapeHtml(circuit.script || "Safari circuit") : circuit.script || "Safari circuit"}</p>
      <h1>${Cards ? Cards.escapeHtml(circuit.name) : circuit.name}</h1>
      ${ledeHtml}
    `;
    els.hero.hidden = false;
    els.hero.classList.add("is-ready");
    document.body.classList.add("has-hero");
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
      const circuit = await Content.getCircuitBySlug(slug, options);
      if (!circuit) {
        showNotFound();
        return;
      }

      document.title = (circuit.seo && circuit.seo.title) || `${circuit.name} · Ramika Safaris and Tours`;
      const desc = document.querySelector('meta[name="description"]');
      if (desc && circuit.seo && circuit.seo.description) desc.setAttribute("content", circuit.seo.description);
      if (els.robots && circuit.status === "published" && !circuit.isFixture) {
        els.robots.setAttribute("content", "index,follow");
      }

      renderHero(circuit);
      if (els.lede) {
        els.lede.hidden = Boolean(circuit.summary);
        els.lede.textContent = circuit.summary || "";
      }

      let destinations = await Content.getDestinations({ ...options, circuitId: circuit.id });
      let usePreviewCards = preview;

      // When the published catalogue is still empty, show draft/fixture cards if fixtures are enabled.
      if (!destinations.length && !preview) {
        const availability = await Content.getFixtureAvailability();
        if (availability && availability.includeDevelopmentFixtures) {
          destinations = await Content.getDestinations({
            mode: "preview",
            includeFixtures: true,
            circuitId: circuit.id,
          });
          usePreviewCards = true;
        }
      }

      const lookupOptions = usePreviewCards
        ? { mode: "preview", includeFixtures: true }
        : options;
      const [circuits, activities] = await Promise.all([
        Content.getCircuits(lookupOptions),
        Content.getActivities(lookupOptions),
      ]);
      const circuitsById = Object.fromEntries((circuits || []).map((item) => [item.id, item]));
      const activitiesById = Object.fromEntries((activities || []).map((item) => [item.id, item]));

      if (els.loading) els.loading.hidden = true;
      if (els.notFound) els.notFound.hidden = true;
      if (els.content) els.content.hidden = false;

      if (!destinations.length) {
        if (els.grid) els.grid.innerHTML = "";
        if (els.empty) els.empty.hidden = false;
        if (els.gridStatus) els.gridStatus.textContent = "";
        return;
      }

      if (els.empty) els.empty.hidden = true;
      if (els.gridStatus) {
        els.gridStatus.textContent = `${destinations.length} destination${destinations.length === 1 ? "" : "s"} on this circuit`;
      }
      if (els.grid && Cards) {
        els.grid.innerHTML = destinations
          .map((item) =>
            Cards.destinationCard(item, {
              circuitsById,
              activitiesById,
              preview: usePreviewCards,
            })
          )
          .join("");
      }
    } catch (error) {
      console.error(error);
      showNotFound();
    }
  }

  init();
})();
