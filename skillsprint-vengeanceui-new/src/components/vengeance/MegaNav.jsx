import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/**
 * VengeanceUI "Mega Menu Navbar" — same interaction model as the source
 * component (sticky + blurred header, animated desktop mega dropdown,
 * mobile drawer with accordion, Escape-to-close, click-outside-to-close,
 * body scroll lock on mobile, keyboard/focus handling) but built from
 * SkillSprint's own existing routes only — nothing here is a new page.
 *
 * `nav` shape: { explore: [{label, to?, href?, desc}], quick: [{label, to}] }
 * so the exact same route list Layout used to render inline is reused,
 * just grouped for the mega panel + drawer.
 */
export function MegaNav({ brand, nav, rightSlot, mobileFoot }) {
  const [scrolled, setScrolled] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accOpen, setAccOpen] = useState(true);

  const exploreWrapRef = useRef(null);
  const triggerRef = useRef(null);
  const drawerRef = useRef(null);
  const toggleBtnRef = useRef(null);
  const closeTimer = useRef(null);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 6); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Desktop mega panel: click-outside + Escape
  useEffect(() => {
    if (!exploreOpen) return;
    function onDocClick(e) {
      if (exploreWrapRef.current && !exploreWrapRef.current.contains(e.target)) setExploreOpen(false);
    }
    function onKey(e) { if (e.key === "Escape") { setExploreOpen(false); triggerRef.current?.focus(); } }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDocClick); document.removeEventListener("keydown", onKey); };
  }, [exploreOpen]);

  // Mobile drawer: body scroll lock + Escape + focus trap
  useEffect(() => {
    if (!drawerOpen) return;
    document.body.classList.add("mega-lock");
    const firstFocusable = drawerRef.current?.querySelector("a,button");
    firstFocusable?.focus();

    function onKey(e) {
      if (e.key === "Escape") { closeDrawer(); return; }
      if (e.key !== "Tab" || !drawerRef.current) return;
      const focusables = drawerRef.current.querySelectorAll('a,button,[tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("mega-lock");
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  function closeDrawer() {
    setDrawerOpen(false);
    toggleBtnRef.current?.focus();
  }

  function openExplore() {
    clearTimeout(closeTimer.current);
    setExploreOpen(true);
  }
  function scheduleCloseExplore() {
    closeTimer.current = setTimeout(() => setExploreOpen(false), 120);
  }

  const renderExploreLink = (item) => item.href
    ? <a key={item.label} href={item.href} onClick={() => setExploreOpen(false)}><b>{item.label}</b><span>{item.desc}</span></a>
    : <Link key={item.label} to={item.to} onClick={() => setExploreOpen(false)}><b>{item.label}</b><span>{item.desc}</span></Link>;

  return (
    <>
      <header className={`mega-navbar ${scrolled ? "mega-scrolled" : ""}`}>
        <div className="mega-nav-main">
          {brand}
          <nav className="mega-navlinks" aria-label="Primary">
            <Link to="/">Home</Link>
            {!!nav.explore.length && (
              <div className="mega-item-wrap" ref={exploreWrapRef} onMouseEnter={openExplore} onMouseLeave={scheduleCloseExplore}>
                <button
                  ref={triggerRef}
                  className="mega-trigger"
                  aria-haspopup="true"
                  aria-expanded={exploreOpen}
                  onClick={() => setExploreOpen(o => !o)}
                >
                  Explore <span className="mega-caret" aria-hidden="true">▾</span>
                </button>
                <div className={`mega-panel ${exploreOpen ? "mega-open" : ""}`} role="menu">
                  {nav.explore.map(renderExploreLink)}
                </div>
              </div>
            )}
            {nav.quick.map(item => <Link key={item.label} to={item.to}>{item.label}</Link>)}
          </nav>
        </div>
        <div className="nav-actions">
          {rightSlot}
          <button
            ref={toggleBtnRef}
            className="mega-menu-toggle"
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(o => !o)}
          >
            <span />
          </button>
        </div>
      </header>

      <div className={`mega-drawer-backdrop ${drawerOpen ? "mega-open" : ""}`} onClick={closeDrawer} />
      <aside className={`mega-drawer ${drawerOpen ? "mega-open" : ""}`} ref={drawerRef} aria-hidden={!drawerOpen}>
        <div className="mega-drawer-head">
          {brand}
          <button className="mega-icon-close" aria-label="Close menu" onClick={closeDrawer} style={{ background: "transparent", border: 0, fontSize: 22, cursor: "pointer", color: "var(--muted)" }}>✕</button>
        </div>
        <div className="mega-drawer-body">
          <Link to="/" onClick={closeDrawer}>Home</Link>
          {!!nav.explore.length && (
            <div className="mega-acc">
              <button className="mega-acc-trigger" aria-expanded={accOpen} onClick={() => setAccOpen(o => !o)}>
                Explore <span className="mega-caret" aria-hidden="true">▾</span>
              </button>
              <div className={`mega-acc-panel ${accOpen ? "mega-acc-open" : ""}`}>
                {nav.explore.map(item => item.href
                  ? <a key={item.label} href={item.href} onClick={closeDrawer}>{item.label}</a>
                  : <Link key={item.label} to={item.to} onClick={closeDrawer}>{item.label}</Link>)}
              </div>
            </div>
          )}
          <div className="mega-acc" style={{ borderTop: nav.explore.length ? undefined : "none" }}>
            {nav.quick.map(item => <Link key={item.label} to={item.to} onClick={closeDrawer}>{item.label}</Link>)}
          </div>
        </div>
        <div className="mega-drawer-foot">{mobileFoot}</div>
      </aside>
    </>
  );
}

export default MegaNav;
