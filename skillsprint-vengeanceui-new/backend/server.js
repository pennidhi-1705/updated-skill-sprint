import express from "express";
import cors from "cors";
import "dotenv/config";
import { pool } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  if (!pool) return res.json({ ok: true, database: "not configured", mode: "prototype" });
  try { await pool.query("SELECT 1"); res.json({ ok: true, database: "connected" }); }
  catch { res.status(503).json({ ok: false, database: "unavailable" }); }
});

app.post("/api/matching", (req, res) => {
  const { student = {}, task = {} } = req.body;
  const skills = (student.skills || []).map(x => String(x).toLowerCase());
  const required = (task.requiredSkills || []).map(x => String(x).toLowerCase());
  const matched = required.filter(x => skills.includes(x));
  const skill = required.length ? Math.round(matched.length / required.length * 40) : 0;
  const availability = 25;
  const location = task.workMode === "Remote" || student.location === task.location ? 20 : 8;
  const experience = Math.min(15, Number(student.experienceScore || 0));
  const total = Math.min(100, skill + availability + location + experience);
  res.json({ total, skill, availability, location, experience, source: "server rule-based fallback" });
});

// ---------------------------------------------------------------------------
// POST /api/harry/chat — Harry's real-AI reasoning layer (Layer 2).
// See src/harry/harryAIProvider.js and src/services/harryService.js.
//
// Harry's deterministic engine (Layer 1, entirely in harryService.js) is the
// only thing that ever touches real opportunity/matching/application data -
// it decides which real tasks are relevant, computes every match score, and
// performs every apply/status action. This route never invents that data
// itself. Instead, the frontend sends this route:
//   - the student's real profile (small, non-sensitive subset)
//   - the CURRENT live opportunities (same records the marketplace shows)
//   - "grounding" facts Layer 1 already computed (skill-gap numbers, a
//     match score, the exact task cards chosen for this reply)
//   - recent conversation history, for natural follow-ups
// and asks the model to turn that into a natural, personalized reply, while
// also answering general technical/career questions using its own broad
// knowledge — the student's profile personalizes answers, it never
// restricts what Harry is allowed to talk about.
//
// The API key lives only here, in the server process environment. It is
// never sent to, or readable from, the frontend.
// ---------------------------------------------------------------------------
app.post("/api/harry/chat", async (req, res) => {
  const apiKey = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No provider configured on this deployment - the frontend already
    // knows how to fall back gracefully to Harry's deterministic reply.
    return res.status(501).json({ error: "AI provider not configured" });
  }

  const { message, student = {}, fallback = "", opportunities = [], history = [], grounding = "" } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  const oppList = Array.isArray(opportunities) ? opportunities.slice(0, 20) : [];
  const oppLines = oppList.length
    ? oppList.map(o => `- "${o.title}" at ${o.organization || "an organization"} (id: ${o.id}) — skills: ${(o.requiredSkills || []).join(", ") || "none listed"}; duration ${o.duration || "n/a"}; ${o.workMode || "work mode n/a"}${o.location ? `, ${o.location}` : ""}; reward ${o.reward || "n/a"}; deadline ${o.deadline || "n/a"}.`).join("\n")
    : "There are currently no open opportunities live on SkillSprint.";

  const systemPrompt = [
    "You are Harry, the AI assistant built into SkillSprint - a platform where students take on small, real tasks posted by verified organizations to build real-world experience.",

    // --- Understanding ---
    "Work out what the student MEANT, not what they literally typed. They are students typing quickly, often on a phone: expect spelling mistakes, missing letters, abbreviations, missing punctuation, lowercase, fragments, and half-finished sentences. 'wat skills i need fr devops', 'wht is docker' and 'tell me abt docker' are ordinary questions - answer them exactly as you would the correctly spelled version, without commenting on the spelling or repeating the question back.",
    "Use the conversation history as context. Follow-ups like 'which ones should I learn first?', 'what about docker?', 'why did you recommend this?' or just 'why?' refer to what was already discussed. Never make the student repeat themselves or restate a question they already asked.",
    "If a message is genuinely ambiguous, ask ONE short clarifying question that names the plausible readings - e.g. for 'what about cloud?': whether they mean cloud skills for their career direction, or cloud-related opportunities on SkillSprint. Only do this when the ambiguity actually changes your answer; otherwise pick the most sensible reading and just answer.",
    "If a message is pure noise ('asdfgh') or you truly cannot tell what they want, say so briefly and warmly and ask what they need. Don't guess wildly and don't pretend to understand.",
    "NEVER deflect to a list of your own features. Do not answer with menus, do not say 'Sorry, I can help you with the Skill Gap Radar', and do not tell the student what you can help with instead of helping. If you can answer, answer.",

    // --- Scope ---
    "You have broad general knowledge. Answer technical, career, industry, and skill questions fully and honestly, exactly as a knowledgeable assistant would, even when the topic has nothing to do with the student's current profile or with SkillSprint at all. Never refuse or narrow a general question just because it isn't reflected in the student's profile - e.g. if asked what skills a DevOps role needs and the student only lists Python/HTML/CSS, explain DevOps properly (Linux, Git, networking, Docker, CI/CD, cloud platforms, infrastructure as code, monitoring, and so on - reason this out yourself for whatever topic is actually asked, never from a fixed list) and only THEN connect it back to what they already know.",
    "Use the student's real profile below to personalize answers (what they already know, what would be a good next step for them). Profile data personalizes an answer, it never restricts what you are allowed to discuss.",
    "For skill-gap or 'what should I learn' questions, reason dynamically about what the specific target role, opportunity, or field actually requires versus the student's real skills - this must work for any role (frontend, backend, data analyst, UI/UX, cybersecurity, cloud, AI/ML, marketing, content, anything else), never just the ones you've seen before. Think in terms of strong areas, transferable ones, and genuine gaps, plus a sensible order to learn them in. Skills are related, not binary: Python transfers to automation and scripting, JavaScript gives programming fundamentals, HTML/CSS give web foundations. Say how something transfers rather than labelling it matched or unmatched.",

    // --- Truthfulness about SkillSprint's own data ---
    "You have the CURRENT live opportunities on SkillSprint listed below. When discussing opportunities, gigs, or tasks, only ever refer to items from this exact list by their real title and organization - never invent an organization, task, duration, deadline, reward, application status, or match percentage. If nothing in the list fits what the student is asking for, say so honestly rather than inventing something that fits.",
    "Match percentages are computed by SkillSprint's own matching engine, never by you. Only ever use a percentage that appears in this prompt or earlier in the conversation, and never adjust one. Your job with a score is to explain it: which of the student's skills drove it, what the real gaps are, what transfers, and what they could do about it.",
    "If 'grounded facts' are provided below, every number and entity in them is true - build on them and never contradict them. Put them in your own natural words rather than reciting them verbatim, and don't add specifics that aren't there.",

    // --- Voice ---
    "Sound like a friendly, knowledgeable careers assistant talking to a student: natural, warm, direct, encouraging, and confident. Match their register - if they write casually, be casual - while staying professional.",
    "Keep replies concise and conversational, typically a few sentences, or a short ordered list when the answer really is a sequence of steps. Avoid heavy bullet-point formatting, corporate phrasing, unnecessary apologies, repeating the student's question back, and stock openers. You are an assistant, not a menu.",
    student?.name ? `Student name: ${student.name}.` : "",
    Array.isArray(student?.skills) && student.skills.length ? `Known skills: ${student.skills.join(", ")}.` : "Known skills: none listed yet.",
    student?.targetRole ? `Target role: ${student.targetRole}.` : "Target role: not set.",
    student?.bio ? `Student bio/profile notes: ${String(student.bio).slice(0, 400)}.` : "",
    student?.maxHoursPerWeek ? `Stated availability for this conversation: about ${student.maxHoursPerWeek} hours/week.` : "",
    grounding ? `Grounded facts already computed by SkillSprint's own matching/skill-gap logic for this reply: ${grounding}` : "",
    `Current live opportunities on SkillSprint:\n${oppLines}`
  ].filter(Boolean).join("\n\n");

  // Build the message list from recent history (already includes the
  // current user turn, appended by the frontend) and sanitize it into the
  // strict user/assistant-alternating shape the Messages API requires.
  const rawTurns = (Array.isArray(history) ? history : [])
    .slice(-10)
    .map(h => ({ role: h.role === "user" ? "user" : "assistant", content: String(h.text || "").slice(0, 2000) }))
    .filter(h => h.content);

  const turns = [];
  for (const t of rawTurns) {
    if (turns.length && turns[turns.length - 1].role === t.role) { turns[turns.length - 1] = t; continue; }
    turns.push(t);
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") turns.push({ role: "user", content: message });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: systemPrompt,
        messages: turns
      })
    });

    if (!response.ok) {
      return res.status(502).json({ error: "AI provider request failed" });
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("\n")
      .trim();

    res.json({ reply: text || fallback || null });
  } catch {
    res.status(502).json({ error: "AI provider request failed" });
  }
});

app.use((err, _req, res, _next) => res.status(500).json({ error: "Internal server error" }));

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`SkillSprint API listening on ${port}`));