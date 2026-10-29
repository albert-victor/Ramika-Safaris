/**
 * Destinations listing – published catalogue only by default.
 * Optional ?preview=1 loads draft/fixture records when content.config allows fixtures.
 */
(function () {
  const PAGE_SIZE = 9;
  const Content = window.RamikaContent;
  const Cards = window.RamikaCards;

  const escapeHtml =
    (Cards && Cards.escapeHtml) ||
    ((value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;"));

  const state = {
    destinations: [],
    circuits: [],
    activities: [],
    circuitsById: {},
    activitiesById: {},
    filters: {
      circuit: "all",
      region: "all",
      activity: "all",
      place: "all",
      q: "",
    },
    visibleCount: PAGE_SIZE,
    preview: false,
  };

  const els = {
    toolbar: document.querySelector("[data-dest-toolbar]"),
    status: document.querySelector("[data-dest-status]"),
    grid: document.querySelector("[data-dest-grid]"),
    empty: document.querySelector("[data-dest-empty]"),
    emptyTitle: document.querySelector("[data-dest-empty-title]"),
    emptyBody: document.querySelector("[data-dest-empty-body]"),
    more: document.querySelector("[data-dest-more]"),
    loadMore: document.querySelector("[data-dest-load-more]"),
  };

  const PLACE_MATCHERS = {
    parks: (item) => /national park|crater/i.test(item.name || ""),
    conservation: (item) => /conserv|reserve|protected/i.test(`${item.name || ""} ${item.intro || ""}`),
    mountains: (item) => /mount |mountain|kilimanjaro|oldoinyo|lengai/i.test(item.name || ""),
    heritage: (item) => /rock art|stone age|meteorite|unesco|heritage|historical|site/i.test(item.name || ""),
    islands: (item) => /island/i.test(item.name || ""),
    waters: (item) => /lake|falls|beach|bay|estuary|marine|river/i.test(item.name || ""),
  };

  const PLACE_PAGES = {
    parks: {
      title: "National parks",
      script: "Wild ground",
      kicker: "Explore",
      lede: "Tanzania's flagship parks and crater worlds, from southern Mikumi and Ruaha to northern icons when they belong in your route.",
      gridTitle: "National parks",
      gridLede: "Filter by safari circuit or experience to find the park that fits your journey.",
      image: {
        src: "/images/about_Activities/mikumi_experieces.jpg",
        alt: "Zebras in tall grass on a Tanzania safari.",
      },
      seoTitle: "National parks · Ramika Safaris and Tours",
      seoDescription: "Explore Tanzanian national parks with Ramika Safaris and Tours – filter by circuit and safari experience.",
    },
    conservation: {
      title: "Conservation areas",
      script: "Protected wild",
      kicker: "Explore",
      lede: "Reserves and conservation landscapes where wildlife and community stewardship meet the road.",
      gridTitle: "Conservation areas",
      gridLede: "Narrow by circuit and experience to see reserves that match your itinerary.",
      image: {
        src: "/images/about_Activities/kitulo_main.jpg",
        alt: "Flowering highland grassland in southern Tanzania.",
      },
      seoTitle: "Conservation areas · Ramika Safaris and Tours",
      seoDescription: "Conservation areas and reserves across Tanzania, browsable by circuit and experience.",
    },
    mountains: {
      title: "Mountain ranges",
      script: "High places",
      kicker: "Explore",
      lede: "Peaks, highlands, and trekking country from Kilimanjaro and the Southern Highlands to volcanic slopes.",
      gridTitle: "Mountains & highlands",
      gridLede: "Use circuit and activity filters to find climbing and highland destinations.",
      image: {
        src: "/images/about_Activities/13c63d5d-c642-411c-bba9-c32fbf7a8e87.jpg",
        alt: "Guests on a guided trek through forested highlands.",
      },
      seoTitle: "Mountain ranges · Ramika Safaris and Tours",
      seoDescription: "Mountain and highland destinations in Tanzania – filter by circuit and experience.",
    },
    heritage: {
      title: "Heritage sites",
      script: "Stories in stone",
      kicker: "Explore",
      lede: "Historical and cultural sites that add depth beside wildlife days on the same journey.",
      gridTitle: "Heritage sites",
      gridLede: "Filter by circuit and experience to pair culture with your safari route.",
      image: {
        src: "/images/about_Activities/Special_moments3.jpg",
        alt: "Travellers and guides at a cultural stop on safari.",
      },
      seoTitle: "Heritage sites · Ramika Safaris and Tours",
      seoDescription: "Heritage and historical sites in Tanzania, browsable by circuit and experience.",
    },
    islands: {
      title: "Islands",
      script: "Coast & isles",
      kicker: "Explore",
      lede: "Island and coastal escapes planned beside mainland safari days when the sea belongs in your trip.",
      gridTitle: "Islands",
      gridLede: "Refine by circuit and experience to find island and coastal stops.",
      image: {
        src: "/images/about_Activities/5b8f151c-c243-4caf-b9bf-8ba1edba35bb.jpg",
        alt: "Turquoise water along a sandy shore.",
      },
      seoTitle: "Islands · Ramika Safaris and Tours",
      seoDescription: "Tanzanian islands and coastal getaways with Ramika Safaris and Tours.",
    },
    waters: {
      title: "Lakes & shores",
      script: "Water & sky",
      kicker: "Explore",
      lede: "Lakes, falls, rivers, and marine shores that shape the rhythm of a multi-region itinerary.",
      gridTitle: "Lakes & shores",
      gridLede: "Filter by circuit and experience to discover water-focused destinations.",
      image: {
        src: "/images/about_Activities/5b8f151c-c243-4caf-b9bf-8ba1edba35bb.jpg",
        alt: "Green mountains meeting a blue lake shore.",
      },
      seoTitle: "Lakes & shores · Ramika Safaris and Tours",
      seoDescription: "Lakes, falls, and shores across Tanzania – filter by circuit and experience.",
    },
  };

  const isExplorePage = () => document.body.dataset.page === "explore";

  function applyExplorePlaceMeta(placeKey) {
    const meta = PLACE_PAGES[placeKey];
    if (!meta || !isExplorePage()) return;

    const img = document.querySelector("[data-explore-hero-image]");
    if (img && meta.image?.src) {
      img.src = meta.image.src;
      img.alt = meta.image.alt || "";
    }

    const setText = (selector, text) => {
      const node = document.querySelector(selector);
      if (node && text) node.textContent = text;
    };

    setText("[data-explore-kicker]", meta.kicker);
    setText("[data-explore-script]", meta.script);
    setText("[data-explore-title]", meta.title);
    setText("[data-explore-lede]", meta.lede);
    setText("[data-explore-crumb]", meta.title);
    setText("[data-explore-grid-title]", meta.gridTitle);
    setText("[data-explore-grid-lede]", meta.gridLede);

    if (meta.seoTitle) document.title = meta.seoTitle;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && meta.seoDescription) desc.setAttribute("content", meta.seoDescription);

    document.querySelector("[data-explore-hero]")?.classList.add("is-ready");
  }

  function matchesPlace(destination, place) {
    if (!place || place === "all") return true;
    const matcher = PLACE_MATCHERS[place];
    return matcher ? matcher(destination) : true;
  }

  function readQuery() {
    const params = new URLSearchParams(window.location.search);
    return {
      preview: params.get("preview") === "1",
      circuit: params.get("circuit") || "all",
      region: params.get("region") || "all",
      activity: params.get("activity") || "all",
      place: params.get("place") || "all",
      q: (params.get("q") || "").trim(),
    };
  }

  function writeQuery() {
    const params = new URLSearchParams();
    if (state.preview) params.set("preview", "1");
    if (state.filters.circuit !== "all") params.set("circuit", state.filters.circuit);
    if (state.filters.region !== "all") params.set("region", state.filters.region);
    if (state.filters.activity !== "all") params.set("activity", state.filters.activity);
    if (isExplorePage()) {
      if (state.filters.place && state.filters.place !== "all") {
        params.set("place", state.filters.place);
      }
    } else if (state.filters.place !== "all") {
      params.set("place", state.filters.place);
    }
    if (state.filters.q) params.set("q", state.filters.q);
    const query = params.toString();
    const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, "", next);
  }

  function observeReveals(root) {
    if (window.RamikaMotion) {
      if (root && typeof window.RamikaMotion.observe === "function") {
        window.RamikaMotion.observe(root);
      } else if (typeof window.RamikaMotion.refresh === "function") {
        window.RamikaMotion.refresh();
      }
      return;
    }
    (root || document).querySelectorAll?.(".reveal, .media-reveal").forEach((node) => {
      node.classList.add("is-visible");
    });
  }

  function setStatus(message, loading) {
    if (!els.status) return;
    els.status.textContent = message;
    if (loading) els.status.dataset.state = "loading";
    else delete els.status.dataset.state;
  }

  function destinationCard(destination) {
    if (Cards && Cards.destinationCard) {
      return Cards.destinationCard(destination, {
        circuitsById: state.circuitsById,
        activitiesById: state.activitiesById,
        preview: state.preview,
      });
    }
    return "";
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { sensitivity: "base" })
    );
  }

  function matchesFiltersExcept(destination, exceptKind) {
    if (exceptKind === "*") return true;

    const { circuit, region, activity } = state.filters;

    if (exceptKind !== "circuit" && circuit !== "all") {
      const match = (destination.circuitIds || []).some((id) => {
        const record = state.circuitsById[id];
        return id === circuit || (record && (record.slug === circuit || record.id === circuit));
      });
      if (!match) return false;
    }

    if (exceptKind !== "region" && region !== "all" && destination.region !== region) {
      return false;
    }

    if (exceptKind !== "activity" && activity !== "all") {
      const match = (destination.activityIds || []).some((id) => {
        const record = state.activitiesById[id];
        return id === activity || (record && (record.slug === activity || record.id === activity));
      });
      if (!match) return false;
    }

    return true;
  }

  function availableFilterValues(destinations, exceptKind) {
    const pool = (destinations || []).filter((item) => matchesFiltersExcept(item, exceptKind));
    const circuitIds = uniqueSorted(pool.flatMap((item) => item.circuitIds || []));
    const regions = uniqueSorted(pool.map((item) => item.region));
    const activityIds = uniqueSorted(pool.flatMap((item) => item.activityIds || []));

    return {
      circuits: circuitIds.map((id) => state.circuitsById[id]).filter(Boolean),
      regions,
      activities: activityIds.map((id) => state.activitiesById[id]).filter(Boolean),
    };
  }

  function renderFilterGroup(kind, options, activeValue, allLabel) {
    const group = document.querySelector(`[data-filter-group="${kind}"]`);
    const row = document.querySelector(`[data-filter-options="${kind}"]`);
    if (!group || !row) return false;

    if (!options.length) {
      group.hidden = true;
      row.innerHTML = "";
      return false;
    }

    const buttons = [
      `<button type="button" class="dest-filter-btn${activeValue === "all" ? " is-active" : ""}" data-filter="${kind}" data-value="all" aria-pressed="${activeValue === "all"}">${escapeHtml(allLabel)}</button>`,
      ...options.map((option) => {
        const value = typeof option === "string" ? option : option.slug || option.id;
        const label = typeof option === "string" ? option : option.name;
        const active = activeValue === value;
        return `<button type="button" class="dest-filter-btn${active ? " is-active" : ""}" data-filter="${kind}" data-value="${escapeHtml(value)}" aria-pressed="${active}">${escapeHtml(label)}</button>`;
      }),
    ];

    row.innerHTML = buttons.join("");
    group.hidden = false;
    return true;
  }

  function renderFilters() {
    if (!els.toolbar) return;
    // Each facet lists values still available given the other active filters.
    const circuitOptions = availableFilterValues(state.destinations, "circuit").circuits;
    const regionOptions = availableFilterValues(state.destinations, "region").regions;
    const activityOptions = availableFilterValues(state.destinations, "activity").activities;

    // Keep the active value visible even if the cascade would hide it, so users can clear it.
    const ensureCircuit = () => {
      if (state.filters.circuit === "all") return circuitOptions;
      const active = state.circuits.find(
        (item) => item.slug === state.filters.circuit || item.id === state.filters.circuit
      );
      if (!active) return circuitOptions;
      if (circuitOptions.some((item) => item.id === active.id)) return circuitOptions;
      return circuitOptions.concat(active);
    };
    const ensureRegion = () => {
      if (state.filters.region === "all" || regionOptions.includes(state.filters.region)) {
        return regionOptions;
      }
      return regionOptions.concat(state.filters.region);
    };
    const ensureActivity = () => {
      if (state.filters.activity === "all") return activityOptions;
      const active = state.activities.find(
        (item) => item.slug === state.filters.activity || item.id === state.filters.activity
      );
      if (!active) return activityOptions;
      if (activityOptions.some((item) => item.id === active.id)) return activityOptions;
      return activityOptions.concat(active);
    };

    const hasCircuit = renderFilterGroup("circuit", ensureCircuit(), state.filters.circuit, "All circuits");
    const hasRegion = renderFilterGroup("region", ensureRegion(), state.filters.region, "All regions");
    const hasActivity = renderFilterGroup(
      "activity",
      ensureActivity(),
      state.filters.activity,
      "All experiences"
    );
    els.toolbar.hidden = !(hasCircuit || hasRegion || hasActivity);
  }

  function matchesFilters(destination) {
    const { circuit, region, activity, place } = state.filters;

    if (circuit !== "all") {
      const match = (destination.circuitIds || []).some((id) => {
        const record = state.circuitsById[id];
        return id === circuit || (record && (record.slug === circuit || record.id === circuit));
      });
      if (!match) return false;
    }

    if (region !== "all" && destination.region !== region) return false;

    if (activity !== "all") {
      const match = (destination.activityIds || []).some((id) => {
        const record = state.activitiesById[id];
        return id === activity || (record && (record.slug === activity || record.id === activity));
      });
      if (!match) return false;
    }

    if (!matchesPlace(destination, place)) return false;

    if (state.filters.q) {
      const needle = state.filters.q.toLowerCase();
      const hay = [
        destination.name,
        destination.cardTitle,
        destination.cardTouch,
        destination.region,
        destination.intro,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }

    return true;
  }

  function filteredDestinations() {
    return state.destinations.filter(matchesFilters);
  }

  function showEmpty(filtered, total) {
    if (!els.empty) return;
    els.empty.hidden = false;

    if (total === 0) {
      if (els.emptyTitle) els.emptyTitle.textContent = "No destinations to show yet";
      if (els.emptyBody) {
        els.emptyBody.textContent = state.preview
          ? "Preview mode is on, but no preview destination records were available."
          : "Published destination pages will appear here as the catalogue is completed. Tell us where you want to travel and we will shape the route with you.";
      }
      return;
    }

    if (els.emptyTitle) els.emptyTitle.textContent = "No destinations match these filters";
    if (els.emptyBody) {
      els.emptyBody.innerHTML =
        "Try another circuit, region, or experience – or <button type=\"button\" class=\"dest-clear-filters\" data-dest-clear-filters>clear the filters</button> to see the full list.";
    }
  }

  function renderList() {
    if (!els.grid) return;

    const filtered = filteredDestinations();
    const total = state.destinations.length;
    const page = filtered.slice(0, state.visibleCount);

    els.grid.innerHTML = page.map(destinationCard).join("");

    if (!filtered.length) {
      showEmpty(filtered, total);
      if (els.more) els.more.hidden = true;
      setStatus(
        total === 0
          ? state.preview
            ? "No preview destinations available."
            : "No published destinations yet."
          : "No destinations match the current filters."
      );
      observeReveals(document.querySelector("[data-dest-discover]"));
      return;
    }

    if (els.empty) els.empty.hidden = true;

    const showing = page.length;
    const filterNote =
      state.filters.circuit !== "all" ||
      state.filters.region !== "all" ||
      state.filters.activity !== "all" ||
      state.filters.place !== "all" ||
      Boolean(state.filters.q);

    setStatus(
      filterNote
        ? `Showing ${showing} of ${filtered.length} matching destination${filtered.length === 1 ? "" : "s"}.`
        : `Showing ${showing} of ${filtered.length} destination${filtered.length === 1 ? "" : "s"}.`
    );

    if (els.more) els.more.hidden = showing >= filtered.length;
    observeReveals(els.grid);
  }

  function onFilterClick(event) {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    const kind = button.dataset.filter;
    const value = button.dataset.value || "all";
    if (!kind || !(kind in state.filters)) return;

    state.filters[kind] = value;
    state.visibleCount = PAGE_SIZE;
    writeQuery();
    renderFilters();
    renderList();
  }

  function onLoadMore() {
    state.visibleCount += PAGE_SIZE;
    renderList();
  }

  function clearFilters() {
    state.filters.circuit = "all";
    state.filters.region = "all";
    state.filters.activity = "all";
    if (!isExplorePage()) state.filters.place = "all";
    state.filters.q = "";
    state.visibleCount = PAGE_SIZE;
    writeQuery();
    renderFilters();
    renderList();
  }

  async function resolveLoadOptions() {
    const query = readQuery();
    state.filters.circuit = query.circuit;
    state.filters.region = query.region;
    state.filters.activity = query.activity;
    if (isExplorePage()) {
      const placeKey = Object.prototype.hasOwnProperty.call(PLACE_MATCHERS, query.place)
        ? query.place
        : "parks";
      state.filters.place = placeKey;
      applyExplorePlaceMeta(placeKey);
      if (!query.place || query.place !== placeKey) {
        const params = new URLSearchParams(window.location.search);
        params.set("place", placeKey);
        window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
      }
    } else {
      state.filters.place = Object.prototype.hasOwnProperty.call(PLACE_MATCHERS, query.place)
        ? query.place
        : "all";
    }
    state.filters.q = query.q;

    if (!query.preview) {
      state.preview = false;
      return {};
    }

    const availability = await Content.getFixtureAvailability();
    if (!availability.includeDevelopmentFixtures) {
      state.preview = false;
      return {};
    }

    state.preview = true;
    document.body.dataset.fixtures = "preview";
    return { mode: "preview", includeFixtures: true };
  }

  async function init() {
    const page = document.body.dataset.page;
    if (page !== "destinations" && page !== "explore") return;
    if (!Content) {
      setStatus("Destination data could not be loaded.");
      showEmpty([], 0);
      return;
    }

    setStatus("Loading destinations…", true);

    try {
      const options = await resolveLoadOptions();
      const [destinations, circuits, activities] = await Promise.all([
        Content.getDestinations(options),
        Content.getCircuits(),
        Content.getActivities(),
      ]);

      // Hard guard: public listing never keeps fixture/draft records unless preview was granted.
      state.destinations = (destinations || []).filter((item) => {
        if (state.preview) return true;
        return item && item.status === "published" && !item.isFixture && item.contentOrigin === "production";
      });

      state.circuits = circuits || [];
      state.activities = activities || [];
      state.circuitsById = Object.fromEntries(state.circuits.map((item) => [item.id, item]));
      state.activitiesById = Object.fromEntries(state.activities.map((item) => [item.id, item]));

      // Drop filter values that are not present in the loaded catalogue.
      const available = availableFilterValues(state.destinations, "*");
      const circuitValues = new Set(available.circuits.flatMap((item) => [item.id, item.slug]));
      const activityValues = new Set(available.activities.flatMap((item) => [item.id, item.slug]));
      if (state.filters.circuit !== "all" && !circuitValues.has(state.filters.circuit)) {
        state.filters.circuit = "all";
      }
      if (state.filters.region !== "all" && !available.regions.includes(state.filters.region)) {
        state.filters.region = "all";
      }
      if (state.filters.activity !== "all" && !activityValues.has(state.filters.activity)) {
        state.filters.activity = "all";
      }

      writeQuery();
      renderFilters();
      renderList();
      observeReveals(document.querySelector(".dest-main"));
    } catch (error) {
      console.error(error);
      setStatus("Destination data could not be loaded.");
      state.destinations = [];
      renderFilters();
      showEmpty([], 0);
      if (els.grid) els.grid.innerHTML = "";
      if (els.more) els.more.hidden = true;
    }
  }

  els.toolbar?.addEventListener("click", onFilterClick);
  els.loadMore?.addEventListener("click", onLoadMore);
  els.empty?.addEventListener("click", (event) => {
    if (event.target.closest("[data-dest-clear-filters]")) clearFilters();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
