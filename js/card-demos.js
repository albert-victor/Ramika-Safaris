/**
 * Preview approved Soft Nest cards from catalogue fixtures.
 */
(function () {
  if (document.body.dataset.page !== "card-demos") return;

  const Content = window.RamikaContent;
  const Cards = window.RamikaCards;
  const destRoot = document.querySelector("[data-demo-destinations]");
  const pkgRoot = document.querySelector("[data-demo-packages]");

  async function init() {
    if (!Content || !Cards) return;

    const options = { mode: "preview", includeFixtures: true };
    try {
      const [destinations, packages, circuits, activities] = await Promise.all([
        Content.getDestinations(options),
        Content.getPackages(options),
        Content.getCircuits(options),
        Content.getActivities(options),
      ]);

      const circuitsById = Object.fromEntries((circuits || []).map((item) => [item.id, item]));
      const activitiesById = Object.fromEntries((activities || []).map((item) => [item.id, item]));
      const destinationsById = Object.fromEntries((destinations || []).map((item) => [item.id, item]));

      if (destRoot) {
        destRoot.innerHTML = (destinations || [])
          .slice(0, 4)
          .map((item) =>
            Cards.destinationCard(item, {
              circuitsById,
              activitiesById,
              preview: true,
            })
          )
          .join("");
      }

      if (pkgRoot) {
        pkgRoot.innerHTML = (packages || [])
          .slice(0, 3)
          .map((item) =>
            Cards.packageCard(item, {
              circuitsById,
              destinationsById,
              activitiesById,
              preview: true,
            })
          )
          .join("");
      }

      if (Cards.bindCardInteractions) Cards.bindCardInteractions(document);
      if (window.RamikaMotion && typeof window.RamikaMotion.refresh === "function") {
        window.RamikaMotion.refresh();
      }
    } catch (error) {
      console.error(error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
