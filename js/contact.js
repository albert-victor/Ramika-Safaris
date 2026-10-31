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
    if (note && params.get("sent") === "1") {
      note.hidden = false;
      note.textContent =
        "Thank you – your enquiry was received. We will reply by email or WhatsApp.";
    }
    const preferredDestination = (params.get("destination") || "").trim();
    const preferredPackage = (params.get("package") || "").trim();

    const loaded = await loadCatalogueOptions(preferredDestination, preferredPackage);

    if (message && preferredPackage && !message.value) {
      const title = loaded.packageTitle || preferredPackage;
      message.value = `I am interested in the "${title}" safari package. Please advise on dates, lodging standards, and next steps.`;
    }

    const dateInput = document.querySelector("[data-enquire-date]");
    const dateOpen = document.querySelector("[data-enquire-date-open]");
    if (dateInput) {
      const today = new Date();
      const iso = today.toISOString().slice(0, 10);
      dateInput.min = iso;
    }
    if (dateInput && dateOpen) {
      dateOpen.addEventListener("click", () => {
        if (typeof dateInput.showPicker === "function") {
          try {
            dateInput.showPicker();
            return;
          } catch (_) {
            /* fall through */
          }
        }
        dateInput.focus();
        dateInput.click();
      });
    }

    if (!form) return;

    // Always point FormSubmit success redirect at the live site (not localhost)
    const LIVE_ORIGIN = "https://ramikasafari.co.tz";
    const nextField = form.querySelector("[data-enquire-next]");
    if (nextField) {
      nextField.value = `${LIVE_ORIGIN}/contact.html?sent=1`;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const adults = form.querySelector("[data-enquire-adults]")?.value;
      const children = form.querySelector("[data-enquire-children]")?.value;
      const startDate = form.querySelector("[data-enquire-date]")?.value;
      if (message && !message.value.includes("Travellers:")) {
        const bits = [];
        if (startDate) bits.push(`preferred start ${startDate}`);
        if (adults) bits.push(`${adults} adult(s)`);
        if (children && children !== "0") bits.push(`${children} child(ren)`);
        if (bits.length) {
          message.value = `${message.value.trim()}\n\nTravellers: ${bits.join("; ")}.`.trim();
        }
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }
      if (note) {
        note.hidden = false;
        note.textContent = "Sending your enquiry to info@ramikasafari.co.tz…";
      }

      const guestEmail = form.querySelector('[name="email"]')?.value || "";
      const replyTo = form.querySelector("[data-enquire-replyto]");
      if (replyTo) replyTo.value = guestEmail;
      if (nextField) nextField.value = `${LIVE_ORIGIN}/contact.html?sent=1`;

      const endpoint = "https://formsubmit.co/ajax/info@ramikasafari.co.tz";
      const body = new FormData(form);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body,
          headers: { Accept: "application/json" },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || "Enquiry could not be sent.");
        }
        const needsActivation = /confirm|activate|check your email/i.test(
          `${result.message || ""} ${result.success || ""}`
        );
        if (note) {
          note.textContent = needsActivation
            ? "Check info@ramikasafari.co.tz for a FormSubmit confirmation link, then click it once. After that, enquiries will arrive there automatically."
            : "Thank you – your enquiry was sent to info@ramikasafari.co.tz. We will reply by email or WhatsApp.";
        }
        if (!needsActivation) form.reset();
      } catch (error) {
        console.error(error);
        // Fallback: open the guest mail client addressed to Ramika
        const name = form.querySelector('[name="name"]')?.value || "";
        const email = form.querySelector('[name="email"]')?.value || "";
        const dest = form.querySelector("[data-enquire-destination]")?.selectedOptions?.[0]?.textContent || "";
        const pkg = form.querySelector("[data-enquire-package]")?.selectedOptions?.[0]?.textContent || "";
        const msg = message?.value || "";
        const subject = encodeURIComponent("Ramika Safaris enquiry");
        const mailBody = encodeURIComponent(
          [
            `Name: ${name}`,
            `Email: ${email}`,
            startDate ? `Preferred start: ${startDate}` : "",
            adults ? `Adults: ${adults}` : "",
            children && children !== "0" ? `Children: ${children}` : "",
            dest && dest !== "No specific destination yet" ? `Destination: ${dest}` : "",
            pkg && pkg !== "No specific package yet" ? `Package: ${pkg}` : "",
            "",
            msg,
          ]
            .filter(Boolean)
            .join("\n")
        );
        window.location.href = `mailto:info@ramikasafari.co.tz?subject=${subject}&body=${mailBody}`;
        if (note) {
          note.textContent =
            "Opening your email app to send to info@ramikasafari.co.tz. If it does not open, email us directly at that address.";
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send enquiry";
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
