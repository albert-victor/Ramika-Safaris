const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector("#site-nav");
const header = document.querySelector(".site-header");
const icon = toggle ? toggle.querySelector("i") : null;
const page = document.body.dataset.page;
const megaItems = document.querySelectorAll(".nav-item.has-mega");
const searchToggle = document.querySelector("[data-header-search-toggle]");
const searchForm = document.querySelector("[data-header-search]");
const searchInput = document.querySelector("[data-header-search-input]");
const siteLoader = document.querySelector("[data-site-loader]");

(function initSiteLoader() {
  if (!siteLoader) return;
  const hide = () => siteLoader.classList.add("is-done");
  const start = performance.now();
  const finish = () => {
    const elapsed = performance.now() - start;
    window.setTimeout(hide, Math.max(0, 480 - elapsed));
  };
  if (document.readyState === "complete") finish();
  else window.addEventListener("load", finish, { once: true });
  window.setTimeout(hide, 4200);
})();

const BOOK_ICON =
  '<img class="btn-book-icon" src="/logo/icons/book-check.png" alt="" width="18" height="18" aria-hidden="true">';
const ENQUIRE_ARROW =
  '<i class="fas fa-arrow-right btn-enquire-arrow" aria-hidden="true"></i>';

document.querySelectorAll("[data-nav]").forEach((el) => {
  if (el.dataset.nav === page) el.setAttribute("aria-current", "page");
});

function decorateCtaButtons(root) {
  const scope = root || document;
  scope.querySelectorAll("a.btn-outline, a.btn-ghost, button.btn-outline").forEach((el) => {
    const label = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!label) return;

    const isBook = /^book now\b/.test(label) || label === "book with us";
    const isEnquire =
      /^enquire\b/.test(label) ||
      label === "enquire now" ||
      label.startsWith("request a custom") ||
      label.startsWith("plan your safari") ||
      label.startsWith("plan a custom");

    if (isBook) {
      el.classList.add("btn-book");
      if (!el.querySelector(".btn-book-icon")) {
        el.insertAdjacentHTML("afterbegin", BOOK_ICON);
      }
    }

    if (isEnquire) {
      el.classList.add("btn-enquire");
      if (!el.querySelector(".btn-enquire-arrow")) {
        el.insertAdjacentHTML("beforeend", ` ${ENQUIRE_ARROW}`);
      }
    }
  });
}

decorateCtaButtons(document);

const ctaObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches?.("a.btn-outline, a.btn-ghost, button.btn-outline")) {
        decorateCtaButtons(node.parentElement || document);
      } else if (node.querySelector) {
        decorateCtaButtons(node);
      }
    });
  });
});
ctaObserver.observe(document.body, { childList: true, subtree: true });

const searchResults = document.querySelector("[data-header-search-results]");
const searchFormEl = document.querySelector("[data-header-search-form]");
let searchTimer = null;
let searchSeq = 0;

function escapeSearchHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setSearchOpen(open) {
  if (!searchForm || !searchToggle) return;
  searchForm.hidden = !open;
  searchToggle.setAttribute("aria-expanded", open ? "true" : "false");
  if (!open && searchResults) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
  }
  if (open && searchInput) {
    window.requestAnimationFrame(() => searchInput.focus());
  }
}

function renderSearchResults(groups, query) {
  if (!searchResults) return;
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  if (!query) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
    return;
  }
  if (!total) {
    searchResults.hidden = false;
    searchResults.innerHTML = `<p class="header-search-empty">No matches for “${escapeSearchHtml(query)}”.</p>`;
    return;
  }

  searchResults.hidden = false;
  searchResults.innerHTML = groups
    .filter((group) => group.items.length)
    .map(
      (group) => `
      <div class="header-search-group">
        <p class="header-search-group-label">${escapeSearchHtml(group.label)}</p>
        <ul>
          ${group.items
            .map(
              (item) => `
            <li>
              <a href="${escapeSearchHtml(item.href)}">
                <strong>${escapeSearchHtml(item.title)}</strong>
                ${item.note ? `<span>${escapeSearchHtml(item.note)}</span>` : ""}
              </a>
            </li>`
            )
            .join("")}
        </ul>
      </div>`
    )
    .join("");
}

async function runAjaxSearch(rawQuery) {
  const query = String(rawQuery || "").trim();
  const seq = ++searchSeq;
  if (!query) {
    renderSearchResults([], "");
    return;
  }
  if (!window.RamikaContent) {
    renderSearchResults([], query);
    return;
  }

  if (searchResults) {
    searchResults.hidden = false;
    searchResults.innerHTML = `<p class="header-search-empty">Searching…</p>`;
  }

  try {
    const needle = query.toLowerCase();
    const [destinations, packages, activities] = await Promise.all([
      window.RamikaContent.getDestinations(),
      window.RamikaContent.getPackages(),
      window.RamikaContent.getActivities(),
    ]);
    if (seq !== searchSeq) return;

    const matchText = (...parts) =>
      parts
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);

    const destItems = (destinations || [])
      .filter((item) => matchText(item.name, item.cardTitle, item.cardTouch, item.region, item.intro))
      .slice(0, 5)
      .map((item) => ({
        title: item.cardTitle || item.name,
        note: item.region || item.cardTouch || "Destination",
        href: `/destination.html?slug=${encodeURIComponent(item.slug)}`,
      }));

    const pkgItems = (packages || [])
      .filter((item) => matchText(item.title, item.summary, item.cardSubtitle))
      .slice(0, 5)
      .map((item) => ({
        title: item.title,
        note: item.cardSubtitle || item.duration || "Safari",
        href: `/package.html?slug=${encodeURIComponent(item.slug)}`,
      }));

    const actItems = (activities || [])
      .filter((item) => matchText(item.name, item.summary))
      .slice(0, 5)
      .map((item) => ({
        title: item.name,
        note: "Activity",
        href: `/activity.html?slug=${encodeURIComponent(item.slug)}`,
      }));

    renderSearchResults(
      [
        { label: "Destinations", items: destItems },
        { label: "Safaris", items: pkgItems },
        { label: "Activities", items: actItems },
      ],
      query
    );
  } catch (error) {
    console.warn("Search unavailable.", error);
    if (seq !== searchSeq) return;
    if (searchResults) {
      searchResults.hidden = false;
      searchResults.innerHTML = `<p class="header-search-empty">Search could not load right now.</p>`;
    }
  }
}

if (searchToggle && searchForm) {
  searchToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setSearchOpen(searchForm.hidden);
  });

  document.addEventListener("click", (event) => {
    if (!searchForm.hidden && !searchForm.contains(event.target) && !searchToggle.contains(event.target)) {
      setSearchOpen(false);
    }
  });
}

if (searchInput) {
  searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => runAjaxSearch(searchInput.value), 220);
  });
}

if (searchFormEl) {
  searchFormEl.addEventListener("submit", (event) => {
    const query = (searchInput?.value || "").trim();
    if (!query) {
      event.preventDefault();
      return;
    }
    // Keep Go as a full destinations fallback; live results already use AJAX.
    if (searchResults && !searchResults.hidden && searchResults.querySelector("a")) {
      event.preventDefault();
      const first = searchResults.querySelector("a");
      if (first) window.location.href = first.getAttribute("href");
    }
  });
}

function collapseApi() {
  if (!nav || !window.bootstrap) return null;
  return window.bootstrap.Collapse.getOrCreateInstance(nav, { toggle: false });
}

function closeMega(item) {
  if (!item) return;
  const trigger = item.querySelector(".nav-trigger");
  const panel = item.querySelector(".mega-panel");
  item.classList.remove("is-open");
  if (trigger) trigger.setAttribute("aria-expanded", "false");
  if (panel) panel.hidden = true;
}

function openMega(item) {
  megaItems.forEach((other) => {
    if (other !== item) closeMega(other);
  });
  const trigger = item.querySelector(".nav-trigger");
  const panel = item.querySelector(".mega-panel");
  item.classList.add("is-open");
  if (trigger) trigger.setAttribute("aria-expanded", "true");
  if (panel) panel.hidden = false;
}

function closeAllMegas() {
  megaItems.forEach(closeMega);
}

megaItems.forEach((item) => {
  const trigger = item.querySelector(".nav-trigger");
  if (!trigger) return;

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    if (item.classList.contains("is-open")) closeMega(item);
    else openMega(item);
  });

  item.addEventListener("focusout", (event) => {
    if (item.contains(event.relatedTarget)) return;
    closeMega(item);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeAllMegas();
  setSearchOpen(false);
  if (nav && nav.classList.contains("show")) {
    const menu = collapseApi();
    if (menu) menu.hide();
    if (toggle) toggle.focus();
  }
});

document.addEventListener("click", (event) => {
  if (![...megaItems].some((item) => item.contains(event.target))) {
    closeAllMegas();
  }
  if (window.innerWidth >= 1100 || !nav || !nav.classList.contains("show")) return;
  if (nav.contains(event.target) || (toggle && toggle.contains(event.target))) return;
  const menu = collapseApi();
  if (menu) menu.hide();
});

if (nav && toggle && icon) {
  nav.addEventListener("shown.bs.collapse", () => {
    icon.classList.replace("fa-bars", "fa-xmark");
    toggle.setAttribute("aria-label", "Close menu");
    if (header) header.classList.add("is-open");
  });

  nav.addEventListener("hidden.bs.collapse", () => {
    icon.classList.replace("fa-xmark", "fa-bars");
    toggle.setAttribute("aria-label", "Open menu");
    if (header) header.classList.remove("is-open");
    closeAllMegas();
  });
}

function paintHeader() {
  if (!header) return;
  if (!document.body.classList.contains("has-hero")) {
    header.classList.add("is-solid");
    return;
  }
  const solid = window.scrollY > 28;
  header.classList.toggle("is-solid", solid);
  header.classList.toggle("is-top", !solid);
}

paintHeader();
window.addEventListener("scroll", paintHeader, { passive: true });
window.addEventListener("resize", () => {
  if (window.innerWidth >= 1100) closeAllMegas();
  paintHeader();
});

(function initWhatsAppFloat() {
  const float = document.querySelector("[data-wa-float]");
  if (!float) return;

  const footer = document.querySelector(".site-footer");
  const homeHero = document.body.dataset.page === "home" ? document.querySelector("[data-home-hero], .home-hero") : null;

  const update = () => {
    const viewportH = window.innerHeight || 0;
    let hide = false;

    if (homeHero) {
      const heroRect = homeHero.getBoundingClientRect();
      // Hide while the landing hero still fills most of the viewport
      if (heroRect.bottom > viewportH * 0.55) hide = true;
    }

    if (footer) {
      const footerRect = footer.getBoundingClientRect();
      if (footerRect.top < viewportH - 24) hide = true;
    }

    float.classList.toggle("is-hidden", hide);
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
})();
