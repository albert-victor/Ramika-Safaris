/**
 * Safari packages listing – published catalogue only by default.
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
    packages: [],
    destinations: [],
    circuits: [],
    activities: [],
    destinationsById: {},
    circuitsById: {},
    activitiesById: {},
    filters: {
      duration: "all",
      circuit: "all",
      destination: "all",
      activity: "all",
    },
    sort: "catalogue",
    visibleCount: PAGE_SIZE,
    preview: false,
  };

  const els = {
    toolbar: document.querySelector("[data-pkg-toolbar]"),
    status: document.querySelector("[data-pkg-status]"),
    grid: document.querySelector("[data-pkg-grid]"),
    empty: document.querySelector("[data-pkg-empty]"),
    emptyTitle: document.querySelector("[data-pkg-empty-title]"),
    emptyBody: document.querySelector("[data-pkg-empty-body]"),
    more: document.querySelector("[data-pkg-more]"),
    loadMore: document.querySelector("[data-pkg-load-more]"),
    sortWrap: document.querySelector("[data-pkg-sort]"),
    sortSelect: document.querySelector("[data-pkg-sort-select]"),
  };

  function readQuery() {
    const params = new URLSearchParams(window.location.search);
    return {
      preview: params.get("preview") === "1",
      duration: params.get("duration") || "all",
      circuit: params.get("circuit") || "all",
      destination: params.get("destination") || "all",
      activity: params.get("activity") || "all",
      sort: params.get("sort") || "catalogue",
    };
  }

  function writeQuery() {
    const params = new URLSearchParams();
    if (state.preview) params.set("preview", "1");
    if (state.filters.duration !== "all") params.set("duration", state.filters.duration);
    if (state.filters.circuit !== "all") params.set("circuit", state.filters.circuit);
    if (state.filters.destination !== "all") params.set("destination", state.filters.destination);
    if (state.filters.activity !== "all") params.set("activity", state.filters.activity);
    if (state.sort !== "catalogue") params.set("sort", state.sort);
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

  function packageCard(pkg) {
    if (!Cards || !Cards.packageCard) return "";
    return Cards.packageCard(pkg, {
      preview: state.preview,
      circuitsById: state.circuitsById,
      destinationsById: state.destinationsById,
      activitiesById: state.activitiesById,
    });
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { sensitivity: "base" })
    );
  }

  const DURATION_BUCKETS = [
    {
      id: "day-trip",
      name: "Day trips",
      match(pkg) {
        const days = Number(pkg?.duration?.days);
        const label = String(pkg?.duration?.label || "").toLowerCase();
        if (/hour|day trip|half.?day/.test(label)) return true;
        return Number.isFinite(days) && days > 0 && days <= 1;
      },
    },
    {
      id: "2-3",
      name: "2–3 days",
      match(pkg) {
        const days = Number(pkg?.duration?.days);
        return Number.isFinite(days) && days >= 2 && days <= 3;
      },
    },
    {
      id: "4-6",
      name: "4–6 days",
      match(pkg) {
        const days = Number(pkg?.duration?.days);
        return Number.isFinite(days) && days >= 4 && days <= 6;
      },
    },
    {
      id: "7-plus",
      name: "7+ days",
      match(pkg) {
        const days = Number(pkg?.duration?.days);
        return Number.isFinite(days) && days >= 7;
      },
    },
  ];

  function durationBucketId(pkg) {
    const bucket = DURATION_BUCKETS.find((item) => item.match(pkg));
    return bucket ? bucket.id : null;
  }

  function matchesFiltersExcept(pkg, exceptKind) {
    if (exceptKind === "*") return true;

    const { duration, circuit, destination, activity } = state.filters;

    if (exceptKind !== "duration" && duration !== "all") {
      const bucket = DURATION_BUCKETS.find((item) => item.id === duration);
      if (bucket) {
        if (!bucket.match(pkg)) return false;
      } else if (durationBucketId(pkg) !== duration) {
        return false;
      }
    }

    if (exceptKind !== "circuit" && circuit !== "all") {
      const match = (pkg.circuitIds || []).some((id) => {
        const record = state.circuitsById[id];
        return id === circuit || (record && (record.slug === circuit || record.id === circuit));
      });
      if (!match) return false;
    }

    if (exceptKind !== "destination" && destination !== "all") {
      const match = (pkg.destinationIds || []).some((id) => {
        const record = state.destinationsById[id];
        return id === destination || (record && (record.slug === destination || record.id === destination));
      });
      if (!match) return false;
    }

    if (exceptKind !== "activity" && activity !== "all") {
      const match = (pkg.activityIds || []).some((id) => {
        const record = state.activitiesById[id];
        return id === activity || (record && (record.slug === activity || record.id === activity));
      });
      if (!match) return false;
    }

    return true;
  }

  function availableFilterValues(packages, exceptKind) {
    const pool = (packages || []).filter((item) => matchesFiltersExcept(item, exceptKind));
    const durations = DURATION_BUCKETS.filter((bucket) => pool.some((pkg) => bucket.match(pkg))).map(
      (bucket) => ({ id: bucket.id, slug: bucket.id, name: bucket.name })
    );
    const circuitIds = uniqueSorted(pool.flatMap((item) => item.circuitIds || []));
    const destinationIds = uniqueSorted(pool.flatMap((item) => item.destinationIds || []));
    const activityIds = uniqueSorted(pool.flatMap((item) => item.activityIds || []));

    return {
      durations,
      circuits: circuitIds.map((id) => state.circuitsById[id]).filter(Boolean),
      destinations: destinationIds
        .map((id) => state.destinationsById[id])
        .filter(Boolean)
        .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" })),
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
      `<button type="button" class="pkg-filter-btn${activeValue === "all" ? " is-active" : ""}" data-filter="${kind}" data-value="all" aria-pressed="${activeValue === "all"}">${escapeHtml(allLabel)}</button>`,
      ...options.map((option) => {
        const value = typeof option === "string" ? option : option.slug || option.id;
        const label = typeof option === "string" ? option : option.name;
        const active = activeValue === value;
        return `<button type="button" class="pkg-filter-btn${active ? " is-active" : ""}" data-filter="${kind}" data-value="${escapeHtml(value)}" aria-pressed="${active}">${escapeHtml(label)}</button>`;
      }),
    ];

    row.innerHTML = buttons.join("");
    group.hidden = false;
    return true;
  }

  function renderDestinationSelect(options, activeValue) {
    const group = document.querySelector(`[data-filter-group="destination"]`);
    const row = document.querySelector(`[data-filter-options="destination"]`);
    if (!group || !row) return false;

    if (!options.length) {
      group.hidden = true;
      row.innerHTML = "";
      return false;
    }

    const opts = [
      `<option value="all"${activeValue === "all" ? " selected" : ""}>All destinations</option>`,
      ...options.map((option) => {
        const value = option.slug || option.id;
        const selected = activeValue === value || activeValue === option.id ? " selected" : "";
        return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(option.name)}</option>`;
      }),
    ];

    row.innerHTML = `
      <label class="visually-hidden" for="pkg-destination-select">Destination</label>
      <select id="pkg-destination-select" class="pkg-sort-select pkg-filter-select" data-filter-select="destination">
        ${opts.join("")}
      </select>
    `;
    group.hidden = false;
    return true;
  }

  function ensureOption(list, activeValue, lookup) {
    if (activeValue === "all") return list;
    if (list.some((item) => item.slug === activeValue || item.id === activeValue || item.name === activeValue)) {
      return list;
    }
    const found = lookup(activeValue);
    return found ? list.concat(found) : list;
  }

  function renderFilters() {
    if (!els.toolbar) return;

    const durationOptions = availableFilterValues(state.packages, "duration").durations;
    const circuitOptions = availableFilterValues(state.packages, "circuit").circuits;
    const destinationOptions = availableFilterValues(state.packages, "destination").destinations;
    const activityOptions = availableFilterValues(state.packages, "activity").activities;

    const hasDuration = renderFilterGroup(
      "duration",
      ensureOption(durationOptions, state.filters.duration, (value) => ({
        id: value,
        slug: value,
        name: value,
      })),
      state.filters.duration,
      "All durations"
    );
    const hasCircuit = renderFilterGroup(
      "circuit",
      ensureOption(circuitOptions, state.filters.circuit, (value) =>
        state.circuits.find((item) => item.slug === value || item.id === value)
      ),
      state.filters.circuit,
      "All circuits"
    );
    const hasDestination = renderDestinationSelect(
      ensureOption(destinationOptions, state.filters.destination, (value) =>
        state.destinations.find((item) => item.slug === value || item.id === value)
      ),
      state.filters.destination
    );
    const hasActivity = renderFilterGroup(
      "activity",
      ensureOption(activityOptions, state.filters.activity, (value) =>
        state.activities.find((item) => item.slug === value || item.id === value)
      ),
      state.filters.activity,
      "All experiences"
    );

    const hasSort = state.packages.length > 1;
    if (els.sortWrap) {
      els.sortWrap.hidden = !hasSort;
      if (els.sortSelect) els.sortSelect.value = state.sort;
    }

    els.toolbar.hidden = !(hasDuration || hasCircuit || hasDestination || hasActivity || hasSort);
  }

  function matchesFilters(pkg) {
    return matchesFiltersExcept(pkg, null);
  }

  function sortPackages(list) {
    const items = list.slice();
    if (state.sort === "title") {
      return items.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    }
    if (state.sort === "duration-asc" || state.sort === "duration-desc") {
      const dir = state.sort === "duration-asc" ? 1 : -1;
      return items.sort((a, b) => {
        const ad = a.duration && Number.isFinite(Number(a.duration.days)) ? Number(a.duration.days) : null;
        const bd = b.duration && Number.isFinite(Number(b.duration.days)) ? Number(b.duration.days) : null;
        if (ad == null && bd == null) return a.title.localeCompare(b.title);
        if (ad == null) return 1;
        if (bd == null) return -1;
        return (ad - bd) * dir || a.title.localeCompare(b.title);
      });
    }
    return items;
  }

  function filteredPackages() {
    return sortPackages(state.packages.filter(matchesFilters));
  }

  function showEmpty(filtered, total) {
    if (!els.empty) return;
    els.empty.hidden = false;

    if (total === 0) {
      if (els.emptyTitle) els.emptyTitle.textContent = "No packages to show yet";
      if (els.emptyBody) {
        els.emptyBody.textContent = state.preview
          ? "Preview mode is on, but no preview package records were available."
          : "Published safari packages will appear here as the catalogue is completed. Tell us where you want to travel and we will shape an itinerary with you.";
      }
      return;
    }

    if (els.emptyTitle) els.emptyTitle.textContent = "No packages match these filters";
    if (els.emptyBody) {
      els.emptyBody.innerHTML =
        "Try another duration, circuit, destination, or experience – or <button type=\"button\" class=\"pkg-clear-filters\" data-pkg-clear-filters>clear the filters</button> to see the full list.";
    }
  }

  function renderList() {
    if (!els.grid) return;

    const filtered = filteredPackages();
    const total = state.packages.length;
    const page = filtered.slice(0, state.visibleCount);

    els.grid.innerHTML = page.map(packageCard).join("");

    if (!filtered.length) {
      showEmpty(filtered, total);
      if (els.more) els.more.hidden = true;
      setStatus(
        total === 0
          ? state.preview
            ? "No preview packages available."
            : "No published packages yet."
          : "No packages match the current filters."
      );
      observeReveals(document.querySelector("[data-pkg-discover]"));
      return;
    }

    if (els.empty) els.empty.hidden = true;

    const showing = page.length;
    const filterNote = Object.values(state.filters).some((value) => value !== "all");

    setStatus(
      filterNote
        ? `Showing ${showing} of ${filtered.length} matching package${filtered.length === 1 ? "" : "s"}.`
        : `Showing ${showing} of ${filtered.length} package${filtered.length === 1 ? "" : "s"}.`
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

  function onFilterSelect(event) {
    const select = event.target.closest("[data-filter-select]");
    if (!select) return;

    const kind = select.dataset.filterSelect;
    const value = select.value || "all";
    if (!kind || !(kind in state.filters)) return;

    state.filters[kind] = value;
    state.visibleCount = PAGE_SIZE;
    writeQuery();
    renderFilters();
    renderList();
  }

  function onSortChange(event) {
    const value = event.target.value || "catalogue";
    const allowed = new Set(["catalogue", "duration-asc", "duration-desc", "title"]);
    state.sort = allowed.has(value) ? value : "catalogue";
    state.visibleCount = PAGE_SIZE;
    writeQuery();
    renderList();
  }

  function onLoadMore() {
    state.visibleCount += PAGE_SIZE;
    renderList();
  }

  function clearFilters() {
    state.filters.duration = "all";
    state.filters.circuit = "all";
    state.filters.destination = "all";
    state.filters.activity = "all";
    state.visibleCount = PAGE_SIZE;
    writeQuery();
    renderFilters();
    renderList();
  }

  async function resolveLoadOptions() {
    const query = readQuery();
    state.filters.duration = query.duration;
    state.filters.circuit = query.circuit;
    state.filters.destination = query.destination;
    state.filters.activity = query.activity;
    state.sort = ["catalogue", "duration-asc", "duration-desc", "title"].includes(query.sort)
      ? query.sort
      : "catalogue";

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
    if (document.body.dataset.page !== "packages") return;
    if (!Content) {
      setStatus("Package data could not be loaded.");
      showEmpty([], 0);
      return;
    }

    setStatus("Loading packages…", true);

    try {
      const options = await resolveLoadOptions();
      const [packages, destinations, circuits, activities] = await Promise.all([
        Content.getPackages(options),
        Content.getDestinations(options),
        Content.getCircuits(),
        Content.getActivities(),
      ]);

      state.packages = (packages || []).filter((item) => {
        if (state.preview) return true;
        return item && item.status === "published" && !item.isFixture && item.contentOrigin === "production";
      });

      state.destinations = destinations || [];
      state.circuits = circuits || [];
      state.activities = activities || [];
      state.destinationsById = Object.fromEntries(state.destinations.map((item) => [item.id, item]));
      state.circuitsById = Object.fromEntries(state.circuits.map((item) => [item.id, item]));
      state.activitiesById = Object.fromEntries(state.activities.map((item) => [item.id, item]));

      const available = availableFilterValues(state.packages, "*");
      const durationValues = new Set(available.durations.map((item) => item.id));
      const circuitValues = new Set(available.circuits.flatMap((item) => [item.id, item.slug]));
      const destinationValues = new Set(available.destinations.flatMap((item) => [item.id, item.slug]));
      const activityValues = new Set(available.activities.flatMap((item) => [item.id, item.slug]));

      if (state.filters.duration !== "all" && !durationValues.has(state.filters.duration)) {
        state.filters.duration = "all";
      }
      if (state.filters.circuit !== "all" && !circuitValues.has(state.filters.circuit)) {
        state.filters.circuit = "all";
      }
      if (state.filters.destination !== "all" && !destinationValues.has(state.filters.destination)) {
        state.filters.destination = "all";
      }
      if (state.filters.activity !== "all" && !activityValues.has(state.filters.activity)) {
        state.filters.activity = "all";
      }

      writeQuery();
      renderFilters();
      renderList();
      observeReveals(document.querySelector(".pkg-main"));
    } catch (error) {
      console.error(error);
      setStatus("Package data could not be loaded.");
      state.packages = [];
      renderFilters();
      showEmpty([], 0);
      if (els.grid) els.grid.innerHTML = "";
      if (els.more) els.more.hidden = true;
    }
  }

  els.toolbar?.addEventListener("click", onFilterClick);
  els.toolbar?.addEventListener("change", onFilterSelect);
  els.loadMore?.addEventListener("click", onLoadMore);
  els.sortSelect?.addEventListener("change", onSortChange);
  els.empty?.addEventListener("click", (event) => {
    if (event.target.closest("[data-pkg-clear-filters]")) clearFilters();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
