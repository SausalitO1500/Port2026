(() => {
  /**
   * Homepage side navigation items.
   * Keep in sync with the markup inside #side-nav / #mobile-nav in index.html.
   */
  const SIDE_NAV_ITEMS = [
    { id: "hero", label: "Overview", theme: "dark" },
    { id: "agent-marketplace", label: "Agent marketplace", theme: "dark" },
    { id: "subscriptions", label: "Subscriptions", theme: "dark" },
    { id: "loyalty", label: "Loyalty", theme: "dark" },
    { id: "guides", label: "Skills I bring", theme: "light" },
    { id: "about", label: "About", theme: "dark" },
    { id: "contact", label: "Contact", theme: "dark" },
  ];

  /**
   * Background theme zones. Light covers the full skills block
   * (guides through conviction) until About.
   */
  const THEME_ZONES = [
    { id: "hero", theme: "dark" },
    { id: "agent-marketplace", theme: "dark" },
    { id: "subscriptions", theme: "dark" },
    { id: "loyalty", theme: "dark" },
    { id: "guides", theme: "light" },
    { id: "about", theme: "dark" },
    { id: "contact", theme: "dark" },
  ];

  function SideNavigation(options = {}) {
    const {
      root = "#side-nav",
      mobileRoot = "#mobile-nav",
      items = SIDE_NAV_ITEMS,
      themeZones = THEME_ZONES,
      headerOffset = 0,
      scrollUnlockDelay = 900,
    } = options;

    const nav =
      typeof root === "string" ? document.querySelector(root) : root;
    if (!nav || !items.length) return null;

    const mobileNav =
      typeof mobileRoot === "string"
        ? document.querySelector(mobileRoot)
        : mobileRoot;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let activeId = items[0].id;
    let currentTheme = null;
    let lockedId = null;
    let unlockTimer = null;
    let ticking = false;
    let mobileOpen = false;

    /** @type {Map<string, HTMLElement[]>} */
    const linkById = new Map();
    const labelById = new Map(items.map((item) => [item.id, item.label]));

    const mobileToggle = mobileNav?.querySelector(".mobile-nav__toggle");
    const mobileCurrent = mobileNav?.querySelector("[data-mobile-nav-current]");
    const mobilePanel = mobileNav?.querySelector(".mobile-nav__panel");
    const mobileMedia = window.matchMedia("(max-width: 720px)");

    function registerLinks(scope) {
      if (!scope) return;
      scope.querySelectorAll(".side-nav__link").forEach((link) => {
        const id = link.dataset.section;
        if (!id) return;
        const list = linkById.get(id) || [];
        list.push(link);
        linkById.set(id, list);
      });
    }

    function ensureMarkup(scope) {
      if (!scope) return;

      let links = scope.querySelectorAll(".side-nav__link");
      if (!links.length) {
        const list = document.createElement("ul");
        list.className = "side-nav__list";

        items.forEach((item, index) => {
          const li = document.createElement("li");
          li.className = "side-nav__item";

          const link = document.createElement("a");
          link.className = "side-nav__link";
          link.href = `#${item.id}`;
          link.dataset.section = item.id;
          if (index === 0) {
            link.classList.add("is-active");
            link.setAttribute("aria-current", "location");
          }

          const indicator = document.createElement("span");
          indicator.className = "side-nav__indicator";
          indicator.setAttribute("aria-hidden", "true");

          const label = document.createElement("span");
          label.className = "side-nav__label";
          label.textContent = item.label;

          link.append(indicator, label);
          li.append(link);
          list.append(li);
        });

        const panelInner = scope.querySelector(".mobile-nav__panel-inner");
        if (panelInner) {
          list.classList.add("mobile-nav__list");
          panelInner.append(list);
        } else {
          scope.append(list);
        }
      }

      registerLinks(scope);
    }

    function getDocumentTop(el) {
      return el.getBoundingClientRect().top + window.pageYOffset;
    }

    function setTheme(theme) {
      if (theme === currentTheme) return;
      currentTheme = theme;
      document.body.classList.toggle("side-nav-theme-dark", theme === "dark");
      document.body.classList.toggle("side-nav-theme-light", theme === "light");
    }

    function setMobileOpen(open) {
      if (!mobileNav || !mobileToggle) return;
      mobileOpen = Boolean(open);
      mobileNav.classList.toggle("is-open", mobileOpen);
      mobileToggle.setAttribute("aria-expanded", mobileOpen ? "true" : "false");
      if (mobilePanel) {
        mobilePanel.toggleAttribute("inert", !mobileOpen);
      }
    }

    function updateMobileCurrent(id) {
      if (!mobileCurrent) return;
      mobileCurrent.textContent = labelById.get(id) || "";
    }

    function setActive(id, { force = false } = {}) {
      if (!id || !linkById.has(id)) return;
      if (!force && lockedId && id !== lockedId) return;
      if (id === activeId && !force) return;

      activeId = id;

      linkById.forEach((links, linkId) => {
        const isActive = linkId === id;
        links.forEach((link) => {
          link.classList.toggle("is-active", isActive);
          if (isActive) {
            link.setAttribute("aria-current", "location");
          } else {
            link.removeAttribute("aria-current");
          }
        });
      });

      updateMobileCurrent(id);
    }

    function getHeaderOffset() {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue("--side-nav-scroll-offset")
        .trim();
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : headerOffset;
    }

    /**
     * Active line near the top third of the viewport. Panels enter from the
     * bottom while scrolling down — using the viewport top (old behavior)
     * waited until the new panel filled the screen (~halfway through it).
     */
    function getActiveProbeY() {
      return window.scrollY + getHeaderOffset() + window.innerHeight * 0.28;
    }

    /**
     * Theme line slightly above the fixed nav center so label contrast flips
     * before cream text sits on a light panel (no floating pink dots).
     */
    function getThemeProbeY() {
      return window.scrollY + window.innerHeight * 0.42;
    }

    function resolveIdAt(probeY, zones) {
      let current = zones[0]?.id;
      for (const zone of zones) {
        const el = document.getElementById(zone.id);
        if (!el) continue;
        // Live measurement each frame — cached tops went stale after layout
        if (probeY >= getDocumentTop(el) - 0.5) current = zone.id;
      }
      return current;
    }

    function resolveActiveFromScroll() {
      let current = resolveIdAt(getActiveProbeY(), items);

      const scrollBottom = window.scrollY + window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      if (docHeight - scrollBottom < 64) {
        current = items[items.length - 1].id;
      }

      return current;
    }

    function resolveThemeFromScroll() {
      const id = resolveIdAt(getThemeProbeY(), themeZones);
      const zone = themeZones.find((entry) => entry.id === id);
      return zone?.theme || "dark";
    }

    function syncFromScroll() {
      // Theme always tracks the background under the nav, even during
      // programmatic smooth-scroll locks.
      setTheme(resolveThemeFromScroll());
      if (lockedId) return;
      setActive(resolveActiveFromScroll());
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        syncFromScroll();
        ticking = false;
      });
    }

    function scrollToSection(id) {
      const target = document.getElementById(id);
      if (!target) return;

      const top = Math.max(0, getDocumentTop(target) - getHeaderOffset());

      lockedId = id;
      setActive(id, { force: true });
      setTheme(
        themeZones.find((zone) => zone.id === id)?.theme ||
          resolveThemeFromScroll()
      );
      window.clearTimeout(unlockTimer);

      window.scrollTo({
        top,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });

      unlockTimer = window.setTimeout(() => {
        lockedId = null;
        syncFromScroll();
      }, prefersReducedMotion ? 50 : scrollUnlockDelay);
    }

    function observeSections() {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
    }

    function onNavClick(event) {
      const link = event.target.closest(".side-nav__link");
      if (!link) return;

      const inDesktop = nav.contains(link);
      const inMobile = mobileNav?.contains(link);
      if (!inDesktop && !inMobile) return;

      const id = link.dataset.section;
      if (!id || !document.getElementById(id)) return;

      event.preventDefault();
      if (inMobile) setMobileOpen(false);
      scrollToSection(id);
      history.pushState(null, "", `#${id}`);
    }

    function bindClicks() {
      nav.addEventListener("click", onNavClick);
      if (mobileNav) {
        mobileNav.addEventListener("click", onNavClick);
      }
    }

    function syncNavMode() {
      const isMobile = mobileMedia.matches;
      nav.toggleAttribute("inert", isMobile);
      if (mobileNav) mobileNav.toggleAttribute("inert", !isMobile);
      if (!isMobile) setMobileOpen(false);
    }

    function bindMobileChrome() {
      if (!mobileNav || !mobileToggle) return;

      setMobileOpen(false);
      syncNavMode();

      mobileToggle.addEventListener("click", () => {
        if (!mobileMedia.matches) return;
        setMobileOpen(!mobileOpen);
      });

      mobileNav.addEventListener("click", (event) => {
        if (event.target.closest("[data-mobile-nav-close]")) {
          setMobileOpen(false);
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && mobileOpen) {
          setMobileOpen(false);
          mobileToggle.focus();
        }
      });

      if (typeof mobileMedia.addEventListener === "function") {
        mobileMedia.addEventListener("change", syncNavMode);
      } else if (typeof mobileMedia.addListener === "function") {
        mobileMedia.addListener(syncNavMode);
      }
    }

    ensureMarkup(nav);
    ensureMarkup(mobileNav);
    bindClicks();
    bindMobileChrome();
    observeSections();
    setActive(items[0].id, { force: true });
    setTheme(resolveThemeFromScroll());

    const hashId = window.location.hash.replace(/^#/, "");
    if (hashId && linkById.has(hashId)) {
      window.requestAnimationFrame(() => scrollToSection(hashId));
    } else {
      syncFromScroll();
    }

    return {
      setActive,
      scrollToSection,
      getActiveId: () => activeId,
      setMobileOpen,
    };
  }

  SideNavigation({
    root: "#side-nav",
    mobileRoot: "#mobile-nav",
    items: SIDE_NAV_ITEMS,
    themeZones: THEME_ZONES,
  });
})();
