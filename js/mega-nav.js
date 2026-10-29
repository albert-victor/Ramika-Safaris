/**
 * Compact mega-nav: circuit links and safari visual swap.
 * Activities is a plain nav link (no mega panel).
 */
(function () {
  const Content = window.RamikaContent;
  if (!Content) return;

  const CIRCUIT_LABELS = {
    "circuit-northern": "Northern Circuit",
    "circuit-southern": "Southern Circuit",
    "circuit-western": "Western Circuit",
    "circuit-zanzibar": "Ocean Islands",
  };

  const CIRCUIT_ORDER = [
    "circuit-northern",
    "circuit-southern",
    "circuit-western",
    "circuit-zanzibar",
  ];

  const els = {
    circuits: document.querySelector("[data-mega-circuits]"),
    safariLinks: document.querySelectorAll("[data-mega-safaris] a[data-safari-visual]"),
    safariImage: document.querySelector("[data-mega-safari-image]"),
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function circuitLabel(circuit) {
    return CIRCUIT_LABELS[circuit.id] || circuit.name || "Circuit";
  }

  function renderCircuits(circuits) {
    if (!els.circuits) return;
    const ordered = CIRCUIT_ORDER.map((id) => circuits.find((c) => c.id === id)).filter(Boolean);
    const list = ordered.length ? ordered : circuits;

    els.circuits.innerHTML = list
      .map((circuit) => {
        const label = circuitLabel(circuit);
        const href = `/circuit.html?slug=${encodeURIComponent(circuit.slug)}`;
        return `
          <a href="${escapeHtml(href)}">
            <span>${escapeHtml(label)}</span>
            <i class="fas fa-arrow-right" aria-hidden="true"></i>
          </a>
        `;
      })
      .join("");
  }

  function wireSafaris() {
    if (!els.safariImage || !els.safariLinks.length) return;

    const show = (link) => {
      const src = link.getAttribute("data-safari-visual");
      const alt = link.getAttribute("data-safari-alt") || "";
      if (!src) return;
      els.safariLinks.forEach((node) => node.classList.toggle("is-active", node === link));
      if (els.safariImage.getAttribute("src") === src) return;
      els.safariImage.classList.add("is-swapping");
      window.setTimeout(() => {
        els.safariImage.src = src;
        els.safariImage.alt = alt;
        els.safariImage.classList.remove("is-swapping");
      }, 160);
    };

    els.safariLinks.forEach((link, index) => {
      if (index === 0) link.classList.add("is-active");
      link.addEventListener("click", () => show(link));
      link.addEventListener("focus", () => show(link));
    });
  }

  async function init() {
    try {
      const circuits = await Content.getCircuits();
      renderCircuits(circuits || []);
      wireSafaris();
    } catch (error) {
      console.warn("Mega nav: catalogue unavailable.", error);
    }
  }

  init();
})();
