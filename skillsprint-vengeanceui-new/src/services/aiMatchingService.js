import { calculateMatch } from "./matchingService";

// Backend-ready abstraction. No AI secret is ever placed in React.
// If a future /api/matching endpoint exists, this service can call it;
// otherwise it honestly falls back to the transparent local matcher.
export async function getMatch(student, task) {
  try {
    const response = await fetch("/api/matching", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student, task })
    });
    if (response.ok) return await response.json();
  } catch {}
  return { ...calculateMatch(student, task), source: "rule-based fallback" };
}