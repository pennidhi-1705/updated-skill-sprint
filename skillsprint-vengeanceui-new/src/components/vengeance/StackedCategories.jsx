import React, { useRef } from "react";

/**
 * VengeanceUI "Stacked Logos" — since SkillSprint has no real
 * partners/technology-partner logos to show (and the brief explicitly says
 * not to invent fake partnerships), this reuses the same CSS-grid +
 * mouse-following radial glow treatment on the platform's real, existing
 * opportunity categories instead.
 */
export function StackedCategories({ items }) {
  const wrapRef = useRef(null);
  const glowRef = useRef(null);

  function onMove(e) {
    const wrap = wrapRef.current, glow = glowRef.current;
    if (!wrap || !glow) return;
    const rect = wrap.getBoundingClientRect();
    glow.style.left = `${e.clientX - rect.left}px`;
    glow.style.top = `${e.clientY - rect.top}px`;
    glow.style.opacity = "1";
  }
  function onLeave() {
    if (glowRef.current) glowRef.current.style.opacity = "0";
  }

  return (
    <div className="stacked-wrap" ref={wrapRef} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className="stacked-glow" ref={glowRef} aria-hidden="true" />
      <div className="stacked-grid">
        {items.map((label) => (
          <div className="stacked-cell" key={label}>
            <span className="stacked-dot" aria-hidden="true" />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default StackedCategories;
