// harryAIProvider.js
//
// Thin client for Harry's real-AI backend call.
//
// This is the AI REASONING layer (Layer 2). It is used for every
// open-ended/general/career/skill-gap question Harry answers - the
// deterministic engine in services/harryService.js (Layer 1) still owns
// every precise data operation (which opportunities exist, match scores,
// applying, application status) and is never bypassed. This file only ever
// sends Layer 1's own real output (opportunities, computed grounding facts,
// conversation history) to the model so it can turn them into natural
// language and add real, general AI knowledge on top - never the other way
// around.
//
// No API key ever lives in this file or anywhere else in the frontend. The
// key (AI_API_KEY / ANTHROPIC_API_KEY) lives only in the backend process
// environment - see backend/server.js's POST /api/harry/chat.
//
// If the backend route isn't configured (no key set) it responds 501 and we
// silently fall back to Harry's existing deterministic reply. Same for any
// network error or timeout - the student always gets an answer either way.

const AI_ENDPOINT = "/api/harry/chat";
const TIMEOUT_MS = 12000;

/**
 * @param {string} message - the student's raw message
 * @param {object|null} student - current student profile (only a small,
 *   non-sensitive subset is sent - see below)
 * @param {object} context - the running conversation context
 * @param {string} fallbackText - the deterministic engine's own reply, sent
 *   along so the backend can return it verbatim if it has nothing better
 * @param {object} extra
 * @param {Array<object>} [extra.opportunities] - the CURRENT live opportunities
 *   (same data as the marketplace/matching engine), so the AI can recommend
 *   or discuss real tasks instead of inventing any.
 * @param {Array<{role:string,text:string}>} [extra.history] - recent turns of
 *   this conversation so follow-ups ("why?", "what about that one?") keep context.
 * @param {string} [extra.grounding] - short plain-text facts already computed
 *   by the deterministic engine (skill-gap numbers, selected task cards, a
 *   match score) that the AI must treat as true and build language around.
 * @returns {Promise<string|null>} the AI reply text, or null if the AI
 *   provider isn't available/configured/reachable (caller should keep using
 *   its own fallback text in that case)
 */
export async function tryHarryAIProvider(message, student, context, fallbackText, extra = {}) {
  if (typeof fetch !== "function") return null;

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        fallback: fallbackText || "",
        student: {
          name: student?.name || null,
          skills: student?.skills || [],
          targetRole: student?.targetRole || null,
          experienceScore: student?.experienceScore ?? null,
          bio: student?.bio || null,
          maxHoursPerWeek: context?.maxHoursPerWeek ?? null
        },
        opportunities: Array.isArray(extra.opportunities) ? extra.opportunities : [],
        history: Array.isArray(extra.history) ? extra.history : [],
        grounding: extra.grounding || ""
      }),
      signal: controller ? controller.signal : undefined
    });

    if (!res.ok) return null; // e.g. 501 = AI provider not configured on this deployment

    const data = await res.json();
    const text = typeof data?.reply === "string" ? data.reply.trim() : "";
    return text || null;
  } catch {
    // Network error, timeout, route missing in this environment, etc. -
    // Harry just keeps talking using the deterministic engine.
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
