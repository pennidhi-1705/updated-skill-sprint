import React, { useRef, useState, useCallback, useEffect } from "react";

/**
 * VengeanceUI "Highlight Grid" — a single highlight pill glides behind the
 * hovered cell. Labels are real SkillSprint concepts only (no invented
 * functionality); cells are informational, matching the source component's
 * behaviour of highlighting cells rather than navigating.
 */
export function HighlightGrid({ items, initialActive = 0, className = "" }) {
  const gridRef = useRef(null);
  const [style, setStyle] = useState(null);
  const [activeIndex, setActiveIndex] = useState(initialActive);

  const highlight = useCallback((index) => {
    const grid = gridRef.current;
    if (!grid) return;
    const cell = grid.querySelectorAll(".hg-cell")[index];
    if (!cell) return;
    const gridRect = grid.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    setStyle({
      width: cellRect.width - 8,
      height: cellRect.height - 8,
      transform: `translate(${cellRect.left - gridRect.left + 4}px, ${cellRect.top - gridRect.top + 4}px)`,
      opacity: 1,
    });
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    highlight(initialActive);
    // re-measure once webfonts finish loading, so the pill doesn't sit
    // slightly off after a layout-shifting font swap
    document.fonts?.ready?.then(() => highlight(initialActive)).catch(() => {});
    const onResize = () => highlight(activeIndex);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onEnter = (i) => () => highlight(i);
  const onFocus = (i) => () => highlight(i);
  const onLeave = () => { if (initialActive === null) setStyle(s => s ? { ...s, opacity: 0 } : s); else highlight(initialActive); };

  return (
    <section className="hg-section">
      <div className="hg-grid" ref={gridRef} onMouseLeave={onLeave}>
        <div className="hg-highlight" style={style || {}} />
        {items.map((item, i) => (
          <div
            key={item.label}
            className={`hg-cell ${activeIndex === i ? "hg-active" : ""}`}
            tabIndex={0}
            onMouseEnter={onEnter(i)}
            onFocus={onFocus(i)}
          >
            <span className="hg-icon" aria-hidden="true">{item.icon}</span>
            <b>{item.label}</b>
            {item.sub && <span>{item.sub}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default HighlightGrid;
