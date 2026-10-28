/**
 * About page – hero readiness; RamikaMotion handles scroll reveals.
 */
(function () {
  if (document.body.dataset.page !== "about") return;

  const hero = document.querySelector(".about-hero");
  if (!hero) return;

  const markReady = () => {
    hero.classList.remove("is-ready");
    requestAnimationFrame(() => hero.classList.add("is-ready"));
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    hero.classList.add("is-ready");
    return;
  }

  markReady();

  if (window.RamikaMotion && typeof window.RamikaMotion.refresh === "function") {
    window.RamikaMotion.refresh();
  }
})();
