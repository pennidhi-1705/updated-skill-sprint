import React, { useMemo } from "react";

/**
 * VengeanceUI FlipText — ported as-is from the source the user supplied.
 * Splits text into characters and flips each on a staggered delay using the
 * `flip-char-rotate` keyframes defined in src/styles/vengeance.css.
 *
 * Accessibility: the animated characters are marked aria-hidden and a plain
 * aria-label carries the real text to assistive tech, so screen readers
 * don't read the string one character at a time.
 */
export function FlipText({
  className = "",
  children,
  duration = 2.2,
  delay = 0,
  loop = true,
  separator = " ",
  together = false,
  as: Tag = "span",
}) {
  const words = useMemo(() => children.split(separator), [children, separator]);
  const totalChars = children.length;

  const getCharIndex = (wordIndex, charIndex) => {
    let index = 0;
    for (let i = 0; i < wordIndex; i++) {
      index += words[i].length + (separator === " " ? 1 : separator.length);
    }
    return index + charIndex;
  };

  return (
    <Tag className={`flip-text-wrapper ${className}`} style={{ perspective: "900px" }} aria-label={children}>
      <span aria-hidden="true">
        {words.map((word, wordIndex) => {
          const chars = word.split("");
          return (
            <span key={wordIndex} className="word" style={{ display: "inline-block", whiteSpace: "nowrap", transformStyle: "preserve-3d" }}>
              {chars.map((char, charIndex) => {
                const currentGlobalIndex = getCharIndex(wordIndex, charIndex);
                let calculatedDelay = delay;
                if (!together) {
                  const normalizedIndex = currentGlobalIndex / totalChars;
                  const sineValue = Math.sin(normalizedIndex * (Math.PI / 2));
                  calculatedDelay = sineValue * (duration * 0.25) + delay;
                }
                return (
                  <span
                    key={charIndex}
                    className="flip-char"
                    style={{
                      display: "inline-block",
                      position: "relative",
                      transformStyle: "preserve-3d",
                      "--flip-duration": `${duration}s`,
                      "--flip-delay": `${calculatedDelay}s`,
                      "--flip-iteration": loop ? "infinite" : "1",
                    }}
                  >
                    {char}
                  </span>
                );
              })}
              {wordIndex < words.length - 1 && (
                <span style={{ display: "inline-block" }}>{separator === " " ? "\u00A0" : separator}</span>
              )}
            </span>
          );
        })}
      </span>
    </Tag>
  );
}

export default FlipText;
