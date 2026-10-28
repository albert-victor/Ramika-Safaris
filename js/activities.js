/**
 * Activities listing.
 */
(function () {
  const Content = window.RamikaContent;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const els = {
    status: document.querySelector("[data-activities-status]"),
    grid: document.querySelector("[data-activities-grid]"),
  };

  function card(activity) {
    const image = activity.image || {};
    const href = `/activity.html?slug=${encodeURIComponent(activity.slug)}`;
    return `
      <a class="activity-card reveal" href="${escapeHtml(href)}">
        <div class="activity-card-media media-reveal">
          ${
            image.src
              ? `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || "")}" loading="lazy" decoding="async" width="800" height="600">`
              : `<div class="card-media-fallback" aria-hidden="true"></div>`
          }
        </div>
        <div class="activity-card-body">
          <h3>${escapeHtml(activity.name)}</h3>
          ${activity.summary ? `<p>${escapeHtml(activity.summary)}</p>` : ""}
          <span class="btn-ghost">View packages <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
        </div>
      </a>
    `;
  }

  async function init() {
    if (!Content || !els.grid) return;
    try {
      const activities = (await Content.getActivities())
        .slice()
        .sort((a, b) => {
          const af = a.featured ? 0 : 1;
          const bf = b.featured ? 0 : 1;
          if (af !== bf) return af - bf;
          return (a.sortOrder || 999) - (b.sortOrder || 999);
        })
        .filter((item, index, list) => {
          // Prefer the featured set on the index; keep legacy tags available via direct URLs.
          if (list.some((entry) => entry.featured)) return item.featured;
          return true;
        });
      if (els.status) {
        els.status.textContent = activities.length
          ? `${activities.length} activities`
          : "No activities published yet";
      }
      els.grid.innerHTML = activities.map(card).join("");
    } catch (error) {
      console.error(error);
      if (els.status) els.status.textContent = "Activities could not be loaded.";
    }
  }

  init();
})();
