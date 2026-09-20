import React, { useEffect, useRef, useState } from "react";

/**
 * VengeanceUI / Skiper-style scroll-progress SVG stroke — adapted from the
 * supplied LinePath demo. The original demo's SkiperUI branding, event copy
 * and 350vh section are intentionally NOT used; only the drawing behaviour
 * (an SVG path that fills in as the wrapped content scrolls through the
 * viewport) is kept.
 *
 * It wraps existing Home page content in place (no extra page height) and
 * renders as a slim rail beside the content on tablet/desktop. On small
 * screens the rail is hidden — purely decorative, the wrapped content is
 * always fully visible and usable without it.
 */
const PATH_LENGTH = 98; // length in user units of "M5 1 L5 99" in a 0-100 viewBox

export function ScrollProgressPath({ children, className = "", strokeColor = "var(--accent2)" }) {
  const wrapRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduceMotion) { setProgress(1); return; }
    let ticking = false;
    function update() {
      const el = wrapRef.current;
      ticking = false;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const start = vh * 0.85;
      const end = -rect.height * 0.15;
      const total = Math.max(1, start - end);
      const current = start - rect.top;
      setProgress(Math.min(1, Math.max(0, current / total)));
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const offset = PATH_LENGTH - PATH_LENGTH * progress;

  return (
    <div className={`scroll-rail-wrap ${className}`} ref={wrapRef}>
      <div className="scroll-rail-track" aria-hidden="true">
        <svg className="scroll-rail-svg" viewBox="0 0 10 100" preserveAspectRatio="none">
          <path d="M5 1 L5 99" className="scroll-rail-bg" />
          <path
            d="M5 1 L5 99"
            className="scroll-rail-fg"
            style={{ stroke: strokeColor, strokeDasharray: PATH_LENGTH, strokeDashoffset: offset }}
          />
        </svg>
        <div className="scroll-rail-dot" style={{ top: `${progress * 100}%` }} />
      </div>
      <div className="scroll-rail-content">{children}</div>
    </div>
  );
}

export default ScrollProgressPath;
