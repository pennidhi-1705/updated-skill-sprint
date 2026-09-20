import { getPublishedTasks, getTask } from "./taskService";
import { getOrganization } from "./organizationService";
import { getApplications } from "./applicationService";
import { calculateMatch } from "./matchingService";
import {
  analyzeSkillGaps,
  recommendSkills,
  recommendNextTasks,
  generateCareerRoadmap,
  generateProfileUpgrade
} from "./aiSkillGapService";
import { tryHarryAIProvider } from "../harry/harryAIProvider";

// ---------------------------------------------------------------------------
// harryService.js — Harry, the SkillSprint Opportunity Assistant.
//
// Harry NEVER invents opportunities, organizations, or match percentages.
// Every list of tasks comes from taskService.getPublishedTasks() (the same
// data the marketplace renders), every match score comes from the existing
// matchingService.calculateMatch(), and every application action goes
// through the real applicationService. This file only adds a thin
// intent-detection + ranking/explanation layer on top of that real data.
//
// No external AI provider or API key is required — everything here is
// deterministic local logic. The functions are kept separate from any UI
// so a real LLM could later be dropped in behind `parseInput` (for intent
// detection) or `explainMatch` (for richer language) without touching the
// chatbot component or the rest of the app.
// ---------------------------------------------------------------------------

export function createInitialContext() {
  return {
    activeTaskId: null,
    lastRecommendedIds: [],
    excludedKeywords: [],
    extraSkills: [],       // session-only skills the student mentioned ("I know Java")
    maxHoursPerWeek: null, // session-only stated availability ceiling
    hasAnalyzedProfile: false,
    history: []            // recent {role, text} turns, sent to the real AI layer for continuity
  };
}

function norm(v) { return String(v || "").trim().toLowerCase(); }

// ---------------------------------------------------------------------------
// General conversation layer.
//
// This is NOT a literal decision tree of exact phrases (no `if message ===
// "hi"`). Each category below is a *cluster* of naturally-worded triggers
// matched with word/phrase patterns, and each has several possible replies
// that are chosen at random so Harry doesn't sound scripted. Anything that
// doesn't fit a known opportunity intent (checked first, in parseInput)
// falls through to here, and anything that doesn't fit here falls through
// to a warm, open-ended default reply rather than a hard failure - so
// unseen phrasing never produces a dead end.
// ---------------------------------------------------------------------------

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const GENERAL_CATEGORIES = [
  {
    id: "greeting",
    test: (t) => /\b(hi|hello|hey|yo|hiya|heya|sup|greetings)\b/.test(t) && t.length < 40,
    responses: [
      "Hey! Good to see you. What's up?",
      "Hi there! How can I help today?",
      "Hey! I'm doing well - what's on your mind?",
      "Hello! Want to chat, or should I look at opportunities for you?"
    ]
  },
  {
    id: "wellbeing",
    test: (t) => /how(?:'s| is| are) (you|your day|things|it going)|how you doin|how'?s life/.test(t),
    responses: [
      "I'm doing great, thanks for asking! What's up with you?",
      "Pretty good! Keeping an eye on opportunities for students like you. How about you?",
      "Can't complain - I'm just a chat window and some logic, but I'm having a good one. What's going on with you?"
    ]
  },
  {
    id: "whatdoing",
    test: (t) => /what are you (doing|up to)|what'?s up\??$|what you doing|what are u (doing|up to)/.test(t),
    responses: [
      "Just here, ready to help - with chatting or finding you real opportunities. What's up?",
      "Hanging out, waiting to be useful! What's on your mind?"
    ]
  },
  {
    id: "boredom",
    test: (t) => /i'?m bored|so bored|nothing to do|bored out of my mind/.test(t),
    responses: [
      "Let's fix that. Want me to pull up some opportunities that match your skills? Could turn boredom into something worth putting on your profile.",
      "Boredom's a good sign it's time to try something new - want me to find a few opportunities for you to browse?"
    ]
  },
  {
    id: "tell_fact",
    test: (t) => /tell me something (interesting|cool|fun)|surprise me|fun fact/.test(t),
    responses: [
      "Here's one: the matching engine here weighs skills at 40%, availability at 25%, location/remote fit at 20%, and experience at 15% - so two students with the same skills can still get different match scores. Want me to run it on your profile?",
      "Fun fact: every match score I show you is computed live from your real profile against real open tasks - nothing here is made up. Want to see your top matches?"
    ]
  },
  {
    id: "uncertain",
    test: (t) => /i don'?t know what to do|not sure what (i should|to) (do|work on)|what should i (do|work on)( today)?|help me decide|i'?m not sure what i should work on/.test(t),
    responses: [
      "Let's figure that out together. I can look at opportunities that match your skills and availability - want me to do that?",
      "No worries - tell me a bit about what you're in the mood for (remote, quick, a specific skill) and I'll find something that fits, or just say \"find opportunities\" and I'll use your profile as-is."
    ]
  },
  {
    id: "capability",
    test: (t) => /what can you help( me)? with|what do you do\??$|what can you do\??$|how can you help( me)?\??$|can you help me\??$/.test(t),
    responses: [
      "Two things, really: I'll chat with you normally, and I can dig into real opportunities on SkillSprint - find matches, explain why something's a good fit, check application status, or take you straight to apply. Just ask naturally.",
      "I'm here for regular conversation and for the practical stuff - finding, filtering, and explaining opportunity matches using your actual profile. What would help right now?"
    ]
  },
  {
    id: "opinion",
    test: (t) => /what do you think\??|your (opinion|thoughts)|do you think\b/.test(t),
    responses: [
      "I don't have personal opinions the way you do, but I can reason it through with you - what's the specific thing you want my take on?",
      "Good question - I'll do my best to think it through with you. Can you give me a bit more to go on?"
    ]
  },
  {
    id: "explain_simpler",
    test: (t) => /explain (that|this) simpl(y|er)|simplify (that|this)|in simple terms|like i'?m five|eli5/.test(t),
    responses: [
      "Sure - what would you like me to simplify? If it's about a task I mentioned, just say which one.",
      "Happy to break it down simply. Which part should I re-explain?"
    ]
  },
  {
    id: "letstalk",
    test: (t) => /let'?s talk|wanna chat|can we talk|talk to me\b/.test(t),
    responses: [
      "Sure, let's talk! What's on your mind?",
      "I'm all ears (well, all text) - go ahead."
    ]
  },
  {
    id: "thanks",
    test: (t) => /\b(thanks|thank you|thx|appreciate it)\b/.test(t),
    responses: ["You're welcome!", "Anytime!", "Happy to help."]
  },
  {
    id: "farewell",
    test: (t) => /\b(bye|goodbye|see you|see ya|later|gotta go|talk later)\b/.test(t),
    responses: ["See you later! I'll be here whenever you need me.", "Bye for now - come back anytime you want to chat or check opportunities."]
  },
  {
    id: "identity",
    test: (t) => /who are you|what are you( exactly)?\??$|are you (a )?(real|human|ai|bot|robot)/.test(t),
    responses: [
      "I'm Harry - SkillSprint's assistant. I'm here to chat and to help you find and understand real opportunities on the platform.",
      "I'm Harry, an AI assistant built into SkillSprint. Think of me as a mix of a friendly chat and a matching engine you can talk to."
    ]
  }
];

function matchGeneralIntent(text) {
  for (const category of GENERAL_CATEGORIES) {
    if (category.test(text)) return category;
  }
  return null;
}

function wordBoundaryIncludes(haystack, needle) {
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

// --------------------------- data access helpers ---------------------------

/** The student profile Harry actually reasons over — real profile plus any
 * skills mentioned earlier in *this* conversation. Nothing is written back
 * to the persisted profile; that stays under the student's own control on
 * the Profile page. */
function effectiveStudent(student, context) {
  if (!context.extraSkills.length) return student;
  const skills = [...new Set([...(student.skills || []), ...context.extraSkills])];
  return { ...student, skills };
}

function isTaskBeginnerFriendly(task) {
  // Real tasks have no "experience level" field. As an honest, explainable
  // stand-in we treat tasks that ask for fewer distinct skills as more
  // approachable, and say so explicitly rather than claiming an official
  // beginner label.
  return (task.requiredSkills || []).length <= 2;
}

function parseDurationDays(duration) {
  const m = norm(duration).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function organizationName(task) {
  return getOrganization(task.organizationId)?.name || "Unknown organization";
}

function applicationFor(studentId, taskId) {
  return getApplications().find(a => a.studentId === studentId && a.taskId === taskId) || null;
}

function toResult(task, student) {
  return { task, match: calculateMatch(student, task) };
}

function rankOpportunities(student, tasks) {
  return tasks.map(t => toResult(t, student)).sort((a, b) => b.match.total - a.match.total);
}

function applyKeywordExclusions(tasks, excludedKeywords) {
  if (!excludedKeywords.length) return tasks;
  return tasks.filter(t => {
    const haystack = `${t.title} ${(t.requiredSkills || []).join(" ")} ${t.description || ""}`.toLowerCase();
    return !excludedKeywords.some(kw => wordBoundaryIncludes(haystack, kw));
  });
}

function universe(context) {
  return applyKeywordExclusions(getPublishedTasks(), context.excludedKeywords);
}

// ------------------------------ intent parsing ------------------------------

const STOPWORDS = new Set(["the","and","for","with","about","this","that","a","an","to","of","on","in","is","it","me","my","i","you","do","does","what","how","can","are","be"]);

function normalize(text) {
  return String(text || "").trim().toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
}

function titleTokens(title) {
  return normalize(title).split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOPWORDS.has(w));
}

function findMentionedTask(input, tasks) {
  const text = normalize(input);
  let best = null;
  for (const task of tasks) {
    const tokens = titleTokens(task.title);
    if (!tokens.length) continue;
    const hits = tokens.filter(t => text.includes(t));
    const score = hits.length / tokens.length;
    if (score > 0.4 && (!best || score > best.score)) best = { task, score };
  }
  return best ? best.task : null;
}

function findOrdinalReference(input, orderedIds) {
  const text = normalize(input);
  const ordinals = { first: 0, "1st": 0, second: 1, "2nd": 1, third: 2, "3rd": 2 };
  for (const [word, idx] of Object.entries(ordinals)) {
    if (text.includes(word) && orderedIds[idx]) return getTask(orderedIds[idx]);
  }
  return null;
}

function findByPercentage(input, ranked) {
  const m = normalize(input).match(/(\d{1,3})\s*(%|percent)/);
  if (!m) return null;
  const pct = parseInt(m[1], 10);
  const hit = ranked.find(r => r.match.total === pct);
  return hit ? hit.task : null;
}

function extractSkillMention(text) {
  const patterns = [
    /\bi know ([a-z0-9+#.\s]+?)(?:\.|,|$| as well| too)/,
    /\bi (?:have|know) (?:skills? in|experience (?:in|with)) ([a-z0-9+#.\s]+?)(?:\.|,|$)/,
    /\bi(?:'m| am) good at ([a-z0-9+#.\s]+?)(?:\.|,|$)/
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractMaxHours(text) {
  const m = text.match(/(\d{1,3})\s*(?:hours|hrs|hr)/);
  if (m && /only have|i have|limited to|less than|under|per week/.test(text)) return parseInt(m[1], 10);
  return null;
}

function extractExcludeKeyword(text) {
  const m = text.match(/don'?t want (?:any )?([a-z\s]+?)(?:\s+work| opportunities|$|\.)/);
  if (m) return m[1].trim();
  const m2 = text.match(/no (?:more )?([a-z\s]+?)(?:\s+work|\.|$)/);
  if (m2) return m2[1].trim();
  return null;
}

function extractIncludeKeyword(text) {
  const patterns = [
    /related to ([a-z0-9\s]+?)(?:\.|$)/,
    /(?:find|show|suggest) (?:me )?(?:something )?(?:in |for )?([a-z0-9\s]+?)(?: opportunities| work|\.|$)/
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1].trim().length > 1 && !STOPWORDS.has(m[1].trim())) return m[1].trim();
  }
  return null;
}

// Students type fast and on phones. This expands the shorthand and misspellings
// that actually show up ("wat skills i need fr devops", "wht is docker", "tell
// me abt docker") so Layer 1's routing isn't thrown by them.
//
// This is a ROUTING aid only - it decides which real data Harry looks up. The
// student's ORIGINAL, untouched text is what gets sent to the AI model, which
// handles spelling, grammar and phrasing far better than any table could. So
// this list never needs to be exhaustive, and a word missing from it costs
// nothing: the message still reaches the model intact.
const SHORTHAND = {
  wat: "what", wot: "what", wht: "what", whats: "what's", wats: "what's", wt: "what",
  hw: "how", y: "why", r: "are", u: "you", ur: "your", yr: "your",
  fr: "for", frm: "from", abt: "about", bout: "about", cud: "could", shud: "should",
  shld: "should", wud: "would", reqd: "required", req: "required", reqs: "requirements",
  skil: "skill", skils: "skills", skillz: "skills", lern: "learn", lrn: "learn",
  plz: "please", pls: "please", thx: "thanks", ty: "thanks", tho: "though",
  bcz: "because", bcoz: "because", coz: "because", cuz: "because",
  dev: "developer", devops: "devops", eng: "engineer", exp: "experience",
  oppty: "opportunity", opp: "opportunity", opps: "opportunities", gud: "good",
  n: "and", nd: "and", im: "i'm", ive: "i've", dont: "don't", doesnt: "doesn't",
  cant: "can't", wont: "won't", isnt: "isn't", didnt: "didn't", couldnt: "couldn't",
  shouldnt: "shouldn't", wanna: "want to", gonna: "going to", gotta: "got to",
  recomend: "recommend", recommand: "recommend", suggst: "suggest",
  knw: "know", noe: "know", jus: "just", jst: "just", alrdy: "already"
};

function expandShorthand(text) {
  return text.replace(/[a-z']+/g, (w) => SHORTHAND[w] || w);
}

export function parseInput(rawInput, context) {
  const text = expandShorthand(normalize(rawInput));

  // Task-detail intents (duration/skills/eligibility/etc.) only make sense
  // when there's an actual task being discussed - either an active one from
  // this conversation, or the message explicitly refers to "this"/"it"/"this
  // task". Otherwise phrasing like "what skills do I need for DevOps?" or
  // "what skills do I need?" would get misrouted into a task-lookup dead end
  // instead of reaching Harry's real AI reasoning layer. See getHarryReply().
  const hasActiveTaskRef = Boolean(context?.activeTaskId) ||
    /\b(this (task|opportunity|one|gig)|that (task|opportunity|one)|it\b)/.test(text);

  if (/how (does|do) (this|it|harry|you) work|what is this (site|platform|app)/.test(text)) return { intent: "how_it_works" };
  if (/analy[sz]e my (profile|resume)|review my (profile|resume)|check my profile/.test(text)) return { intent: "analyze_profile" };

  const skill = extractSkillMention(text);
  if (skill) return { intent: "state_skill", skill };

  const hours = extractMaxHours(text);
  if (hours !== null) return { intent: "state_hours", hours };

  const pctMatch = text.match(/(\d{1,3})\s*(%|percent)/);
  if (/^why\??$/.test(text.trim()) && context?.activeTaskId) {
    return { intent: "why_match" };
  }
  if (/why/.test(text) && (
    /match/.test(text) || /%|percent/.test(text) || /recommend/.test(text) ||
    /good (for|fit)/.test(text) || /suit(s|able)?/.test(text) || /is this (good|right|worth)/.test(text)
  )) {
    return { intent: "why_match", percentage: pctMatch ? parseInt(pctMatch[1], 10) : undefined };
  }

  if (/which (one|opportunity) is best|best (one|match|fit) for me|best opportunity/.test(text)) return { intent: "best_one" };

  if (/have i applied|did i apply|application status|status of my application/.test(text)) return { intent: "application_status" };
  // "Apply" is a real action (it navigates to the application form), so it
  // needs an unambiguous first-person request. Questions about WHETHER someone
  // could apply - "can i apply for this even tho i don't know docker", "can
  // someone with python apply for this" - are asking for reasoning about fit,
  // not a redirect to a form, so they route to eligibility_question and get a
  // real answer instead of "Which opportunity would you like to apply for?".
  if (/\b(can|could|should|may)\s+(i|someone|a student|anyone|somebody|he|she|they|we)\b[^?]*\bapply\b/.test(text) ||
      /am i eligible|do i (qualify|meet)|would i (qualify|be eligible)|is it worth (me )?applying/.test(text)) {
    return { intent: "eligibility_question" };
  }
  if (/^apply\b|i (?:want|'?d like|would like) to apply|let'?s apply|apply now|apply for (this|it)|take me to the application|start (?:my |the )?application/.test(text)) return { intent: "apply" };

  if (hasActiveTaskRef && /how long|duration/.test(text)) return { intent: "detail_duration" };
  if (hasActiveTaskRef && /is (this|it) remote|remote or|work mode|in[- ]person|on[- ]site|work from|where is (this|it)/.test(text)) return { intent: "detail_work_mode" };
  if (hasActiveTaskRef && /what exactly do i (have to do|do)|what will i (be doing|do)|what does it involve|deliverable/.test(text)) return { intent: "detail_deliverables" };
  if (hasActiveTaskRef && /can a beginner|beginner[- ]friendly|do i need experience|experience (level )?required|i don'?t know [a-z]+\.? can i still/.test(text)) return { intent: "detail_eligibility" };
  if (hasActiveTaskRef && /required skills|skills (do i )?need|what skills does (it|this) (need|require)/.test(text)) return { intent: "detail_required_skills" };
  if (hasActiveTaskRef && /reward|stipend|pay|how much/.test(text)) return { intent: "detail_reward" };
  // "explain this opportunity" is a request to go deeper on a task already in
  // play, not a request to run a fresh search - it has to be caught before the
  // broad /opportunit/ search trigger further down, or Harry answers a question
  // nobody asked with a new list of results.
  if (/tell me more|more (details|info|information) about|elaborate|explain (this|it|that|the) ?(task|opportunity|one|gig)?|what is (this|the) (task|opportunity|gig)|break (this|it) down/.test(text)) return { intent: "tell_me_more" };

  const filters = {};
  let hasFilter = false;
  if (/easier|beginner.friendly|simpler|something easy/.test(text)) { filters.easier = true; hasFilter = true; }
  if (/remote/.test(text)) { filters.remote = true; hasFilter = true; }
  if (/don'?t want|no more/.test(text)) {
    const kw = extractExcludeKeyword(text);
    if (kw) { filters.excludeKeyword = kw; hasFilter = true; }
  }
  if (/find|show me|suggest|recommend|related to|something (?:in|for)\b|looking for|want something/.test(text)) {
    const kw = extractIncludeKeyword(text);
    if (kw) filters.includeKeyword = kw;
    hasFilter = true;
  }
  if (hasFilter) return { intent: "find_opportunities", filters };

  if (/opportunit|suitable for me|suit(s)? me|what'?s (out there|available)|gigs?\b/.test(text)) return { intent: "find_opportunities", filters: {} };

  // ---- Student guidance intents (grounded in the student's real profile
  // and real live opportunities via aiSkillGapService - never invented). ----
  if (/learning plan|study plan|weekly plan|make me a plan|turn (this|that) into a plan|plan for (me|learning)/.test(text)) {
    return { intent: "learning_plan" };
  }
  if (/skill gap|what'?s missing|what (?:skills? |else )?am i missing|am i missing (?:any|for)|missing (from|in) my profile|gaps? in my (skills|profile)|where (?:do i|am i) (?:fall short|weak|behind)/.test(text)) {
    return { intent: "skill_gap" };
  }
  if (/project ideas?|what (projects?|should i build)|ideas? for a project|what could i build/.test(text)) {
    return { intent: "project_ideas" };
  }
  if (/internship.?ready|ready for (an )?internship|am i ready (for|to apply)|ready to apply/.test(text)) {
    return { intent: "internship_ready" };
  }
  if (/resume|\bcv\b|portfolio (help|advice|improve)/.test(text)) {
    return { intent: "resume_help" };
  }
  if (/which career|career path|career direction|what career|should i (focus on|go into|choose|pick) (ai|web|frontend|backend|data|dev)/.test(text)) {
    return { intent: "career_direction" };
  }
  if (/what should i learn( next)?\??$|what skills should i (learn|focus on|pick up|work on)|what to learn next|which skills? should i learn|what should i study/.test(text)) {
    return { intent: "what_to_learn" };
  }
  if (/how (can|do) i (improve|get better|level up) my (coding|programming|skills)|improve my (coding|programming)/.test(text)) {
    return { intent: "what_to_learn" };
  }
  if (/hackathon/.test(text)) {
    return { intent: "hackathon_prep" };
  }

  const general = matchGeneralIntent(text);
  if (general) return { intent: "general", category: general.id, responses: general.responses };

  return { intent: "unknown" };
}

// ------------------------------ reply builders ------------------------------

function reply(text, extra = {}) { return { role: "harry", text, tasks: [], ...extra }; }

function resolveTask(input, context, ranked, tasks) {
  const named = findMentionedTask(input, tasks);
  if (named) return named;
  const ordinal = findOrdinalReference(input, context.lastRecommendedIds);
  if (ordinal) return ordinal;
  const byPct = findByPercentage(input, ranked);
  if (byPct) return byPct;
  if (context.activeTaskId) return getTask(context.activeTaskId);
  return null;
}

function explainMatch(match) {
  const reasons = match.reasons?.length ? match.reasons.join(" ") : "your profile was compared against this task's requirements.";
  return `You're a ${match.total}% match because: ${reasons}`;
}

function taskCard(task, student) {
  const match = calculateMatch(student, task);
  const applied = student ? applicationFor(student.id, task.id) : null;
  return {
    id: task.id,
    title: task.title,
    organization: organizationName(task),
    requiredSkills: task.requiredSkills || [],
    duration: task.duration,
    workMode: task.workMode,
    location: task.location,
    deadline: task.deadline,
    reward: task.reward,
    matchScore: match.total,
    explanation: match.reasons?.[0] || "",
    alreadyApplied: Boolean(applied),
    applicationStatus: applied?.status || null
  };
}

function applyFilters(filters, context, ranked) {
  let results = ranked;
  let note = null;
  let nextCtx = context;

  if (filters.easier) {
    results = results.filter(r => isTaskBeginnerFriendly(r.task));
    note = "Since you're after something more approachable, here's what needs fewer distinct skills:";
  }
  if (filters.remote) {
    results = results.filter(r => norm(r.task.workMode) === "remote");
  }
  if (context.maxHoursPerWeek !== null && context.maxHoursPerWeek <= 10) {
    results = results.filter(r => {
      const days = parseDurationDays(r.task.duration);
      return days === null || days <= 2;
    });
  }
  if (filters.excludeKeyword) {
    const kw = filters.excludeKeyword.toLowerCase();
    nextCtx = { ...nextCtx, excludedKeywords: [...new Set([...nextCtx.excludedKeywords, kw])] };
    results = results.filter(r => {
      const haystack = `${r.task.title} ${(r.task.requiredSkills || []).join(" ")} ${r.task.description || ""}`.toLowerCase();
      return !wordBoundaryIncludes(haystack, kw);
    });
    note = `Got it — I'll leave out ${filters.excludeKeyword} work. Here's what's left:`;
  }
  if (filters.includeKeyword) {
    const kw = filters.includeKeyword.toLowerCase();
    const hits = results.filter(r => {
      const haystack = `${r.task.title} ${(r.task.requiredSkills || []).join(" ")} ${r.task.description || ""}`.toLowerCase();
      return wordBoundaryIncludes(haystack, kw);
    });
    if (hits.length) { results = hits; note = `Here's what I found related to ${filters.includeKeyword}:`; }
  }
  return { results, ctx: nextCtx, note };
}

/**
 * Main entry point. Given raw text, the real student profile, the running
 * conversation context, returns a Harry reply plus the updated context.
 */
export function getHarryResponse(rawInput, student, context) {
  if (!student) {
    return { message: reply("I need you to be logged in as a student before I can look at real opportunities for you."), context };
  }

  const parsed = parseInput(rawInput, context);
  const workingStudent = effectiveStudent(student, context);
  const pool = universe(context);
  const ranked = rankOpportunities(workingStudent, pool);

  switch (parsed.intent) {
    case "general":
      return { message: reply(pick(parsed.responses)), context };

    case "how_it_works":
      return { message: reply("I look at your skills, availability, location/work-mode preference and experience, and compare them against real open opportunities on SkillSprint using the same matching engine as the marketplace. I can also just chat - ask me to find opportunities, explain a match, or tell you more about one I've recommended.") , context };

    case "what_to_learn": {
      const gap = analyzeSkillGaps(workingStudent);
      const skills = recommendSkills(workingStudent, gap, 3);
      if (!skills.length) {
        return {
          message: reply(`Your current skills already cover what's showing up in live SkillSprint opportunities pretty well${student.targetRole ? ` for a ${student.targetRole} direction` : ""}. Keep stacking real, completed tasks - that builds verified experience faster than adding more skills right now. If you want, set a target role on your Profile page and I can get more specific.`),
          context
        };
      }
      const list = skills.map((s, i) => `${i + 1}. ${s.skill} - ${s.why}`).join("\n");
      const intro = workingStudent.skills?.length
        ? `You already have ${workingStudent.skills.slice(0, 3).join(", ")}, so based on your real profile and what's actually required across live opportunities, I'd prioritize:`
        : `Your profile doesn't list skills yet, so this is based on what's most in demand across live opportunities right now. I'd prioritize:`;
      return {
        message: reply(`${intro}\n\n${list}\n\nWant me to turn this into a week-by-week plan, or show you opportunities where you could use these?`),
        context: { ...context, lastRecommendedSkills: skills.map(s => s.skill) }
      };
    }

    case "skill_gap": {
      const gap = analyzeSkillGaps(workingStudent);
      const top = gap.topGaps.slice(0, 3);
      if (!top.length) {
        return { message: reply("Your profile looks well-rounded across the skill areas SkillSprint tracks (programming, web dev, data/AI, communication, problem solving, domain knowledge, project experience) - no major gap stands out right now.") , context };
      }
      const lines = top.map(g => `${g.name}: ${g.current}% now → ${g.target}% target (${g.priority.toLowerCase()} priority)`).join("\n");
      return {
        message: reply(`Here's where your profile has the most room to grow, based on your actual profile${student.targetRole ? ` and target role (${student.targetRole})` : ""}:\n\n${lines}\n\nWant specific skills or real opportunities that would close these?`),
        context
      };
    }

    case "learning_plan": {
      const gap = analyzeSkillGaps(workingStudent);
      const skills = recommendSkills(workingStudent, gap, 3);
      const nextTasks = recommendNextTasks(workingStudent, gap, 2);
      const roadmap = generateCareerRoadmap(workingStudent, gap, skills, nextTasks);
      const text = roadmap.map(r => `${r.week} - ${r.stage}: ${r.detail}`).join("\n");
      return {
        message: reply(`Here's a 4-week plan built from your actual profile and live opportunities:\n\n${text}`, { tasks: nextTasks.map(t => taskCard(t.task, student)) }),
        context: { ...context, lastRecommendedIds: nextTasks.map(t => t.task.id) }
      };
    }

    case "project_ideas": {
      const gap = analyzeSkillGaps(workingStudent);
      const nextTasks = recommendNextTasks(workingStudent, gap, 3);
      if (!nextTasks.length) {
        return { message: reply("I'd rather not invent project ideas out of thin air - and there isn't a live opportunity right now that clearly closes one of your skill gaps. Check back as new tasks are published, or tell me a specific skill you want to practice and I'll see what's out there.") , context };
      }
      const lines = nextTasks.map(t => `"${t.task.title}" (${organizationName(t.task)}) - ${t.reason}`).join("\n");
      return {
        message: reply(`Rather than making something up, here are real, open SkillSprint tasks that would work well as project experience for you right now:\n\n${lines}`, { tasks: nextTasks.map(t => taskCard(t.task, student)) }),
        context: { ...context, lastRecommendedIds: nextTasks.map(t => t.task.id) }
      };
    }

    case "internship_ready": {
      const gap = analyzeSkillGaps(workingStudent);
      const strongest = [...gap.categories].sort((a, b) => b.current - a.current)[0];
      const weakest = gap.topGaps[0];
      const completedCount = gap.currentProfile.points.find(p => p.includes("completed SkillSprint project"));
      const base = weakest && weakest.priority === "High"
        ? `Honestly, not quite yet - your biggest gap right now is ${weakest.name} (${weakest.current}% vs a ${weakest.target}% target). I'd close that before applying broadly.`
        : `You're in reasonable shape. Your strongest area is ${strongest.name} (${strongest.current}%)${weakest ? `, and ${weakest.name} (${weakest.current}%) still has some room` : ""}. I'd round that out a bit, but you could realistically start applying now.`;
      return { message: reply(`${base}${completedCount ? ` ${completedCount}.` : " You don't have any completed SkillSprint projects yet - even one finished task goes a long way for internship applications."}`), context };
    }

    case "resume_help": {
      const gap = analyzeSkillGaps(workingStudent);
      const skills = recommendSkills(workingStudent, gap, 3);
      const nextTasks = recommendNextTasks(workingStudent, gap, 2);
      const upgrade = generateProfileUpgrade(workingStudent, gap, skills, nextTasks);
      return {
        message: reply(`${upgrade} On SkillSprint specifically, completed tasks and verified projects carry more weight than resume wording - your Profile page also has an "Upgrade My Profile with AI" tool built on this same analysis if you want the full breakdown.`),
        context
      };
    }

    case "career_direction": {
      const gap = analyzeSkillGaps(workingStudent);
      const strengths = [...gap.categories].sort((a, b) => b.current - a.current).slice(0, 2);
      return {
        message: reply(`I can't tell you which path to love, but here's what your actual profile currently leans toward: your strongest areas are ${strengths.map(s => `${s.name} (${s.current}%)`).join(" and ")}. Tell me a direction you're curious about (AI, web dev, data, etc.) and I'll map out what closing the gap to that would realistically take.`),
        context
      };
    }

    case "hackathon_prep":
      return {
        message: reply(pick([
          "For hackathons: lean on 1-2 skills you're already solid in rather than learning something new the night before, scope something small enough to actually finish, and have a 2-minute pitch ready early. Want me to pull up your current strongest skills so you know what to lean on?",
          "Hackathon prep is mostly about scope and speed - know your top 2-3 skills cold, plan something finishable in the time given, and rehearse the pitch before you're tired. Want a quick look at your skill-gap breakdown so you know what to play to?"
        ])),
        context
      };

    case "state_skill": {
      const skill = parsed.skill.replace(/\bas well\b|\btoo\b/g, "").trim();
      const nextCtx = { ...context, extraSkills: [...new Set([...context.extraSkills, skill])] };
      const nextRanked = rankOpportunities(effectiveStudent(student, nextCtx), pool);
      const top = nextRanked.slice(0, 3);
      return {
        message: reply(`Good to know — I'll factor in ${skill} for this conversation (add it to your profile to keep it permanently). Here's how your matches look now:`, { tasks: top.map(r => taskCard(r.task, student)) }),
        context: { ...nextCtx, lastRecommendedIds: top.map(r => r.task.id), activeTaskId: top[0]?.task.id ?? nextCtx.activeTaskId }
      };
    }

    case "state_hours": {
      const nextCtx = { ...context, maxHoursPerWeek: parsed.hours };
      const { results } = applyFilters({}, nextCtx, ranked);
      const top = results.slice(0, 3);
      return {
        message: reply(`Got it — around ${parsed.hours} hrs/week. I'll lean toward shorter tasks. Here's what fits:`, { tasks: top.map(r => taskCard(r.task, student)) }),
        context: { ...nextCtx, lastRecommendedIds: top.map(r => r.task.id), activeTaskId: top[0]?.task.id ?? nextCtx.activeTaskId }
      };
    }

    case "analyze_profile": {
      if (!student.skills?.length) {
        return { message: reply("Your profile doesn't list any skills yet, so I can't score matches well. Add a few skills on your Profile page and I'll take another look.") , context };
      }
      const top3 = ranked.slice(0, 3);
      const topSkills = student.skills.slice(0, 4).join(", ");
      return {
        message: reply(`I've looked at your profile. Your listed skills are ${topSkills}. Based on real open opportunities, here's what fits best:`, { tasks: top3.map(r => taskCard(r.task, student)) }),
        context: { ...context, hasAnalyzedProfile: true, lastRecommendedIds: top3.map(r => r.task.id), activeTaskId: top3[0]?.task.id ?? context.activeTaskId }
      };
    }

    case "find_opportunities": {
      if (!pool.length) {
        return { message: reply("There aren't any open opportunities on SkillSprint right now — check back soon.") , context };
      }
      const { results, ctx: filteredCtx, note } = applyFilters(parsed.filters || {}, context, ranked);
      const top = results.slice(0, 3);
      if (!top.length) {
        return { message: reply("I couldn't find anything matching that among the currently open opportunities — want me to loosen the filters?"), context: filteredCtx };
      }
      return {
        message: reply(note || "Here are open opportunities that suit you:", { tasks: top.map(r => taskCard(r.task, student)) }),
        context: { ...filteredCtx, lastRecommendedIds: top.map(r => r.task.id), activeTaskId: top[0].task.id }
      };
    }

    case "best_one": {
      if (!ranked.length) return { message: reply("There aren't any open opportunities to compare right now.") , context };
      const best = ranked[0];
      return {
        message: reply(`Based on your profile, "${best.task.title}" at ${organizationName(best.task)} is your strongest real match right now.`, { tasks: [taskCard(best.task, student)] }),
        context: { ...context, activeTaskId: best.task.id, lastRecommendedIds: [best.task.id] }
      };
    }

    case "why_match": {
      let match = null;
      if (parsed.percentage !== undefined) match = ranked.find(r => r.match.total === parsed.percentage)?.match;
      if (!match) {
        const task = resolveTask(rawInput, context, ranked, pool);
        if (task) match = calculateMatch(workingStudent, task);
      }
      if (!match) return { message: reply("Which opportunity did you mean? Ask me to find opportunities first, or name one and I'll explain its match.") , context };
      return { message: reply(explainMatch(match)), context };
    }

    case "application_status": {
      const task = resolveTask(rawInput, context, ranked, pool) || getTask(context.activeTaskId);
      if (!task) return { message: reply("Which opportunity do you mean? Ask me to find opportunities first, or name one.") , context };
      const app = applicationFor(student.id, task.id);
      if (!app) return { message: reply(`You haven't applied to "${task.title}" yet. Want me to open the application for you?`), context: { ...context, activeTaskId: task.id } };
      return { message: reply(`Your application to "${task.title}" is currently: ${app.status}.`), context: { ...context, activeTaskId: task.id } };
    }

    case "apply": {
      const task = resolveTask(rawInput, context, ranked, pool);
      if (!task) return { message: reply("Which opportunity would you like to apply for?"), context };
      const existing = applicationFor(student.id, task.id);
      if (existing) {
        return { message: reply(`You've already applied to "${task.title}" — status: ${existing.status}.`, { tasks: [taskCard(task, student)] }), context: { ...context, activeTaskId: task.id } };
      }
      return {
        message: reply(`I can take you straight to the application for "${task.title}".`, { tasks: [taskCard(task, student)], action: { type: "navigate_apply", taskId: task.id } }),
        context: { ...context, activeTaskId: task.id }
      };
    }

    case "eligibility_question": {
      // Layer 1's job here is only to put the TRUE numbers on the table (what
      // the task lists, what the student actually has, the engine's score).
      // The AI layer turns that into a real answer about whether the gap
      // matters and what's transferable - see getHarryReply().
      const task = resolveTask(rawInput, context, ranked, pool);
      if (!task) {
        return {
          message: reply("Which opportunity are you thinking about? Point me at one and I'll go through what it actually asks for against what you already have — missing a single listed tool often isn't the blocker people assume it is."),
          context
        };
      }
      const match = calculateMatch(workingStudent, task);
      const required = task.requiredSkills || [];
      const held = (workingStudent.skills || []).map(norm);
      const have = required.filter(s => held.includes(norm(s)));
      const missing = required.filter(s => !held.includes(norm(s)));
      return {
        message: reply(
          `"${task.title}" at ${organizationName(task)} lists ${required.join(", ") || "no specific skills"}. ` +
          `On your profile you already have ${have.join(", ") || "none of those exact ones"}` +
          `${missing.length ? `, and ${missing.join(", ")} ${missing.length === 1 ? "isn't" : "aren't"} listed on your profile yet` : ""}. ` +
          `The matching engine scores you at ${match.total}%. Nothing stops you applying either way — the application itself is open to you.`,
          { tasks: [taskCard(task, student)] }
        ),
        context: { ...context, activeTaskId: task.id }
      };
    }

    case "tell_me_more": {
      const task = resolveTask(rawInput, context, ranked, pool);
      if (!task) return { message: reply("Tell me more about which one? Ask me to find opportunities first, or name one directly.") , context };
      return { message: reply(task.description || "No description was provided for this task.", { tasks: [taskCard(task, student)] }), context: { ...context, activeTaskId: task.id } };
    }

    case "detail_duration":
    case "detail_work_mode":
    case "detail_deliverables":
    case "detail_eligibility":
    case "detail_required_skills":
    case "detail_reward": {
      const task = resolveTask(rawInput, context, ranked, pool);
      if (!task) return { message: reply("Which opportunity are you asking about? Once I've recommended one, you can ask follow-up questions without repeating its name.") , context };
      const nextCtx = { ...context, activeTaskId: task.id };
      if (parsed.intent === "detail_duration") return { message: reply(`"${task.title}" runs for about ${task.duration}, with a deadline of ${task.deadline}.`), context: nextCtx };
      if (parsed.intent === "detail_work_mode") return { message: reply(`It's ${norm(task.workMode)} — ${task.location}.`), context: nextCtx };
      if (parsed.intent === "detail_deliverables") return { message: reply(`Deliverables: ${(task.deliverables || []).join(", ") || "not specified"}.`), context: nextCtx };
      if (parsed.intent === "detail_required_skills") return { message: reply(`Required skills: ${(task.requiredSkills || []).join(", ") || "none listed"}.`), context: nextCtx };
      if (parsed.intent === "detail_reward") return { message: reply(`The reward for this task is ${task.reward || "not specified"}.`), context: nextCtx };
      if (parsed.intent === "detail_eligibility") {
        const friendly = isTaskBeginnerFriendly(task);
        return { message: reply(`This task doesn't have a formal experience-level field, but it asks for ${(task.requiredSkills || []).length} skill(s) (${(task.requiredSkills || []).join(", ") || "none listed"}), which ${friendly ? "tends to be approachable if you're just getting started" : "suggests some prior experience will help"}.`), context: nextCtx };
      }
      break;
    }

    case "unknown":
    default:
      // Reached only when the AI layer is unreachable (see getHarryReply).
      // Deliberately NOT a list of Harry's features: reciting the menu is what
      // made him feel like a keypad instead of an assistant. Ask one short,
      // honest question instead.
      return {
        message: reply(pick([
          "Say a bit more about what you're after and I'll take it from there.",
          "I want to make sure I answer the right thing — what specifically are you trying to work out?",
          "Give me a little more to go on and I'll dig into it with you."
        ])),
        context
      };
  }

  return { message: reply("Give me a bit more detail on that and I'll pick it up.") , context };
}

export function getTopMatches(student, limit = 3) {
  return rankOpportunities(student, getPublishedTasks()).slice(0, limit).map(r => taskCard(r.task, student));
}

// ---------------------------------------------------------------------------
// Two-layer architecture.
//
// LAYER 1 (this whole file above) is the deterministic engine: it is the
// ONLY thing that ever decides which real opportunities exist, computes
// match scores, and performs apply/status actions. It's transparent,
// explainable, and needs no network call.
//
// LAYER 2 (below) is Harry's real AI model (see harry/harryAIProvider.js +
// backend/server.js's POST /api/harry/chat). It never invents opportunity
// data itself - it's only ever given Layer 1's own real output (the live
// opportunity list, computed skill-gap numbers, a computed match score) and
// asked to turn that into natural language, while adding genuine general
// knowledge for anything outside the student's profile (career/skill
// questions, explanations, etc).
//
// Layer 2 is the DEFAULT path, not a fallback. Every message reaches the
// model except the two commitments in EXACT_REPLY_INTENTS below (starting an
// application, reporting a stored application status), which must reach the
// student verbatim.
//
// The split is about who OWNS a value, not about who speaks. Layer 1 owns
// every real number - which tasks exist, what they require, what the match
// score is, what the student's gap numbers are - and hands them to Layer 2 as
// grounding it may not change. Layer 2 owns understanding and wording: it
// reads past typos and shorthand, follows "which ones should I learn first?"
// back to the previous turn, answers general technical and career questions
// from its own knowledge, and connects any of it back to the student's real
// profile. That's why grounding constrains facts but never scope.
//
// If no AI provider is configured on this deployment (no AI_API_KEY), or the
// call fails or times out, Harry silently keeps Layer 1's own deterministic
// reply - the student never sees an error, though Harry is noticeably more
// template-like in that mode.
// ---------------------------------------------------------------------------

// Intents that must reach the student WORD FOR WORD, with no model in the
// middle. Both of these are commitments rather than conversation: `apply`
// navigates the student into a real application form, and `application_status`
// reports a stored status string that must never be softened or paraphrased.
//
// Everything else - finding opportunities, reciting a task's duration or
// reward, skill gaps, careers, general knowledge, and anything Harry doesn't
// recognise - now goes through the model, grounded in the real values Layer 1
// just computed. This set used to hold fourteen intents, which is why so many
// ordinary questions ("find me something I can finish today", "what skills
// does this need", "i only have 4 hours") came back as fixed templates.
const EXACT_REPLY_INTENTS = new Set(["apply", "application_status"]);

const HISTORY_LIMIT = 10;

function compactOpportunities(tasks) {
  return tasks.slice(0, 20).map(t => ({
    id: t.id,
    title: t.title,
    organization: organizationName(t),
    requiredSkills: t.requiredSkills || [],
    duration: t.duration,
    workMode: t.workMode,
    location: t.location,
    reward: t.reward,
    deadline: t.deadline
  }));
}

const GAP_GROUNDED_INTENTS = new Set([
  "skill_gap", "what_to_learn", "learning_plan", "analyze_profile",
  "project_ideas", "internship_ready", "resume_help", "career_direction",
  "eligibility_question", "detail_eligibility"
]);

/** Short plain-text facts Layer 1 already computed for this reply, so the
 * AI explains/extends them in natural language instead of re-deriving (or
 * contradicting) them.
 *
 * Note the deliberate asymmetry: the model is told these values are true and
 * must not be changed, but is NOT told to stay inside them. A student asking
 * what DevOps needs should hear about Linux, Git, Docker, CI/CD and cloud
 * whether or not any of those appear in their profile or in a live task. The
 * grounding constrains FACTS about SkillSprint, never the scope of the answer. */
function buildGroundingNotes(intent, deterministic, workingStudent) {
  const notes = [];

  if (GAP_GROUNDED_INTENTS.has(intent)) {
    const gap = analyzeSkillGaps(workingStudent);
    notes.push(
      `Rule-based skill-category baseline (0-100, derived from the student's real profile and completed projects - use it as a starting signal and reason further, don't just read the numbers back): ` +
      gap.categories.map(c => `${c.name} ${c.current}→${c.target} (${c.priority} priority)`).join(", ") + "."
    );
  }

  if (deterministic.message.tasks?.length) {
    notes.push(
      `Real opportunities already selected by SkillSprint's matching engine for this reply, with scores computed by that engine (use exactly these if you mention opportunities - do not invent others, and do not alter a score): ` +
      deterministic.message.tasks.map(t => `"${t.title}" (${t.matchScore}% match, ${t.organization}, skills: ${(t.requiredSkills || []).join("/") || "none listed"}, ${t.workMode}, ${t.duration}, reward ${t.reward}, deadline ${t.deadline}${t.alreadyApplied ? `, student has ALREADY applied - status ${t.applicationStatus}` : ""})`).join("; ") + "."
    );
  }

  // Layer 1 has already looked up whatever this turn needed - a task's real
  // duration, its required skills, a computed match percentage, the student's
  // real gap numbers. Passing its own answer through as authoritative means
  // the model never has to re-derive a value it could get wrong, and the
  // student still hears it in natural language rather than as a template.
  if (deterministic.message.text) {
    notes.push(
      `SkillSprint's own computed answer for this turn - every number, title, organization, date, reward and status in it is TRUE and must not be changed, contradicted or padded with invented specifics. Rephrase it naturally in your own voice and build on it; ignore it entirely if it turns out not to address what the student actually meant: "${deterministic.message.text}"`
    );
  }

  return notes.join(" ");
}

export async function getHarryReply(rawInput, student, context) {
  const safeContext = context?.history ? context : { ...context, history: [] };
  const deterministic = getHarryResponse(rawInput, student, safeContext);
  if (!student) return deterministic;

  const nextHistory = [...safeContext.history, { role: "user", text: rawInput }].slice(-HISTORY_LIMIT);
  const parsed = parseInput(rawInput, safeContext);

  if (EXACT_REPLY_INTENTS.has(parsed.intent)) {
    return {
      message: deterministic.message,
      context: {
        ...deterministic.context,
        history: [...nextHistory, { role: "harry", text: deterministic.message.text }].slice(-HISTORY_LIMIT)
      }
    };
  }

  // Everything else (general conversation, skill gaps, career/learning
  // questions, "why is this good for me", or anything unrecognized) goes to
  // the real AI model, grounded in Layer 1's real data.
  const workingStudent = effectiveStudent(student, safeContext);
  const grounding = buildGroundingNotes(parsed.intent, deterministic, workingStudent);
  const opportunities = compactOpportunities(universe(safeContext));

  const aiText = await tryHarryAIProvider(rawInput, student, safeContext, deterministic.message.text, {
    opportunities,
    history: nextHistory,
    grounding
  });

  const finalMessage = aiText ? { ...deterministic.message, text: aiText } : deterministic.message;

  return {
    message: finalMessage,
    context: {
      ...deterministic.context,
      history: [...nextHistory, { role: "harry", text: finalMessage.text }].slice(-HISTORY_LIMIT)
    }
  };
}
