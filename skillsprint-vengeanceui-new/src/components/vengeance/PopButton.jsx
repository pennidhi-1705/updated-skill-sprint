import React from "react";
import { Link } from "react-router-dom";

/**
 * VengeanceUI "Pop Button" — adapted to SkillSprint's lime/dark-green palette.
 * Renders as a <Link> when `to` is provided (so existing routing is untouched),
 * otherwise as a regular <button> so it can be dropped into forms/onClick handlers.
 *
 * variant: "primary" (lime) | "dark" (deep green) | "ghost" (white/outline)
 * size:    "md" (default) | "sm"
 */
export function PopButton({ to, variant = "primary", size = "md", className = "", children, ...props }) {
  const cls = [
    "pop-btn",
    variant === "dark" ? "pop-btn-dark" : "",
    variant === "ghost" ? "pop-btn-ghost" : "",
    size === "sm" ? "pop-btn-sm" : "",
    className,
  ].filter(Boolean).join(" ");

  if (to) {
    return <Link className={cls} to={to} {...props}>{children}</Link>;
  }
  return <button className={cls} {...props}>{children}</button>;
}

export default PopButton;
