import React from "react";
import { Link } from "react-router-dom";

/**
 * VengeanceUI "Social Flip Button" — letter on the front, icon on the back,
 * 3D flip on hover/focus, tooltip, subtle animated border.
 *
 * SkillSprint has no real social-media accounts to link to, and the brief
 * explicitly says not to invent GitHub/X/LinkedIn/etc. profiles or use
 * href="#". So this is wired to the two legitimate destinations that
 * already exist in the footer (Find a Project / Post a Task) instead of
 * fake social links. The original text links stay exactly as they were;
 * this is placed alongside them as a supplementary, fully-labelled control
 * (aria-label + visible tooltip on hover/focus) — never the only way to
 * reach that destination.
 */
export function SocialFlipButton({ letter, label, icon, to, href, className = "" }) {
  const content = (
    <>
      <span className="flip-social-border" aria-hidden="true" />
      <span className="flip-social-inner">
        <span className="flip-social-face flip-social-front" aria-hidden="true">{letter}</span>
        <span className="flip-social-face flip-social-back" aria-hidden="true">{icon}</span>
      </span>
      <span className="flip-social-tooltip">{label}</span>
    </>
  );
  const cls = `flip-social-btn ${className}`;
  if (to) return <Link to={to} className={cls} aria-label={label}>{content}</Link>;
  return <a href={href} className={cls} aria-label={label}>{content}</a>;
}

export function CompassIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polygon points="14.5,9.5 10.5,10.5 9.5,14.5 13.5,13.5" />
    </svg>
  );
}

export function BriefcaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5" />
      <line x1="3" y1="12.5" x2="21" y2="12.5" />
    </svg>
  );
}

export default SocialFlipButton;
