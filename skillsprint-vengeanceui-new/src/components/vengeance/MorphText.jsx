import React, { useEffect, useRef, useState } from "react";

/**
 * VengeanceUI "Morph Text" — adapted to SkillSprint's existing tokens.
 * Cycles through a short list of words in place, crossfading with a
 * blur/scale/opacity transition (no extra runtime deps — CSS Grid stacks
 * every word in the same cell so the box auto-sizes to the widest word,
 * which keeps the surrounding heading from jumping or overflowing).
 *
 * Used once on the Home page (see App.jsx, ChatShowcaseSection) with
 * SkillSprint's own vocabulary — it does not invent new product claims.
 */
export function MorphText({ words, interval = 2200, className = "", as: Tag = "span" }) {
  const [active, setActive] = useState(0);
  const reduceMotion = useRef(
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (!words || words.length < 2 || reduceMotion.current) return;
    const id = setInterval(() => setActive((i) => (i + 1) % words.length), interval);
    return () => clearInterval(id);
  }, [words, interval]);

  if (!words || !words.length) return null;

  return (
    <Tag className={`morph-text-wrap ${className}`} aria-label={words.join(" / ")}>
      {words.map((word, i) => (
        <span
          key={word}
          className={`morph-text-word ${i === active ? "morph-active" : ""}`}
          aria-hidden="true"
        >
          {word}
        </span>
      ))}
    </Tag>
  );
}

export default MorphText;
