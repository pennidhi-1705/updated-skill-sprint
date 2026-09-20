# SkillSprint final flow correction

This package modifies the existing SkillSprint prototype rather than replacing its design or creating a second application.

## Files modified in this pass

- `src/App.jsx`
  - Landing-page role links now enter the correct Student or Organization login flow.
  - `/login?role=student` and `/login?role=organization` preserve the requested role and route successful login to the matching portal.
  - Existing logged-in users are sent directly to their own portal when the requested role matches.
  - Navigation is role-specific so student, organization, and admin dashboards do not share portal widgets/navigation.
  - Organization posting stays in the Organization Portal and returns to Organization Dashboard/My Tasks after creation.
  - Organization tasks have their own organization-side detail route and are scoped by `organizationId`.
  - Student Opportunities remains backed by the shared `tasks` collection through `getPublishedTasks()`.
  - Organization Applications is scoped to the exact organization and exact task IDs; reject now visibly updates the application state.
  - Project submission/review pages enforce the owning student/organization relationship.
  - Existing back navigation is retained and organization task details now return to the organization dashboard.

- `src/services/taskService.js`
  - Uses the shared `tasks` collection and filters student-visible tasks by task status and verified organization.
  - Task creation stores the real `organizationId` on the task.

- `src/services/applicationService.js`
  - Stores `studentId`, `taskId`, and the task's exact `organizationId` on every application.
  - Prevents applications to unverified/unavailable tasks and duplicate student/task applications.

- `src/services/projectService.js`
  - Links projects to the exact `taskId`, `studentId`, and `organizationId`.
  - Reuses an existing matching project instead of creating a duplicate.
  - Links submissions to the exact `projectId` and carries review feedback/status back to the same submission.

- `database/schema.sql`
  - Keeps one shared relational model for organizations, tasks, applications, projects, submissions, and reviews.
  - Applications include `organization_id` and indexes support the shared relationships.

## What was wrong

1. Landing-page role links could behave as informational anchors instead of role entry points.
2. Organization task creation navigated to the generic marketplace task route, which made the organization-side flow look like a student flow.
3. The generic marketplace allowed organization/admin sessions to enter student-oriented opportunity screens.
4. Organization task cards opened student/marketplace task details rather than an organization-owned task view.
5. Organization application filtering contained a legacy fallback that could admit records without an explicit organization relationship.
6. Submission/review pages did not fully enforce ownership at the component level.

## Shared synchronization

Organization B creates one task record in `tasks` with `organizationId`.

If that task is eligible for student visibility, `getPublishedTasks()` reads that same record and Student Opportunities renders it. There is no `studentTasks` copy.

A student application stores the exact `studentId`, `taskId`, and `organizationId` from the selected task. Organization Applications filters that same application record by the logged-in organization's ID.

Accepting an application creates/reuses one project using the same three IDs. Both Student Projects and Organization Projects read that same project record.

Student submission stores one submission against that project's `projectId`. Organization Review reads that exact submission. Approval changes the same project's status to `Completed` and stores the review/feedback against the same project/submission flow.

## Role separation

- Student → `/student/dashboard`, with student-only navigation and guarded student routes.
- Organization → `/organization/dashboard`, with organization-only navigation and guarded organization routes.
- Admin → `/admin`, with admin-only access.
- A logged-in organization is redirected away from `/opportunities`; a logged-in student is redirected away from organization pages by the existing role guards.

## Test flow

1. Open `/` and click **For Students** → Student Login.
2. Click **For Organizations** → Organization Login.
3. Log in/register as an organization → only Organization Dashboard is available.
4. Post a task → remain in Organization Portal → My Tasks shows the exact saved task.
5. If the prototype's organization verification is required, verify the organization in Admin first.
6. Log in separately as a student → only Student Dashboard is available.
7. Open Student → Opportunities → the eligible organization-created task appears from the shared `tasks` data.
8. Open the task and apply → the application stores the exact student/task/organization IDs.
9. Log in as the organization → Applications → the exact student and task appear.
10. Select the student → the application becomes `Selected` and one shared project is created.
11. Student → Projects → the same project appears.
12. Student submits work → the submission is stored against the same `projectId`.
13. Organization opens the same project → sees the exact submission.
14. Organization approves → the same project becomes `Completed` and the student sees the completed/verified state.

No intentional visual redesign was made.

---

# Pass 2: AI-assisted verification, following, messaging, notifications

This pass implements the "verified organizations + opportunity marketplace +
professional networking + direct messaging" upgrade on top of the existing
prototype architecture (React + Vite, localStorage-backed services). It does
**not** stand up a real backend, OCR pipeline, government API, or WebSocket
server — those need real infrastructure and credentials this environment
doesn't have. Every simulated piece is labeled as such in code comments and,
where it matters, in the UI copy itself.

## New services

- `src/services/aiVerificationService.js` — deterministic, clearly-labeled
  simulation of an AI document-consistency check. Produces field match
  scores and a confidence score; never claims authenticity. Swap
  `extractFieldsFromDocument()` for a real OCR/LLM call before production.
- `src/services/governmentVerificationService.js` — mock government-registry
  provider, explicitly named as mock in its own output (`provider` field).
  Replace with a real MCA/GSTIN/Udyam API behind the same function
  signature.
- `src/services/organizationService.js` — `runVerificationPipeline()` now
  runs automatically on registration and resubmission, combining the two
  services above into a `Verified` / `Needs Attention` / `Rejected` result.
  High-confidence + government-matched cases are marked `Verified`
  immediately; everything else is routed to the internal review console
  instead of being silently approved. Every pipeline run and manual review
  action is written to an audit log (`getAuditLogs`).
- `src/services/followService.js` — student → organization follow/unfollow.
- `src/services/notificationService.js` — in-app notifications (new
  application, shortlisted, new message, followed org posted).
- `src/services/conversationService.js` + `src/services/chatService.js` —
  permissioned 1:1 conversations between a student and an organization.
  Default permission (`applicants` — the spec's safest default): a student
  can message an organization once they've applied to one of its
  opportunities; organizations can widen this to followers or anyone from
  their profile settings.

## What changed in the UI

- Nav gained **Organizations**, **Network**, **Messages**, and a
  notification bell (student/organization roles only). The internal review
  console (formerly `/admin`) is still never linked from public or
  organization navigation — only reachable by an account with the `admin`
  role, per the "no public admin portal" requirement.
- New pages: `/organizations` (verified-org directory + search),
  `/organizations/:orgId` (public profile with Follow/Message, never shows
  verification documents or internal AI/government results), `/network`
  (followed organizations), `/messages` (conversation list + chat window),
  `/notifications`.
- Organization Verification page now shows the AI confidence breakdown and
  government-record match, with a "Needs Attention" path that explains what
  didn't match and lets the organization resubmit.
- Organization Applications gained a **Shortlist** action (distinct from
  **Select**) and a **Message** button; shortlisting sends the student a
  notification.
- Landing page gained a Discover Organizations section (real verified orgs
  only, no fabricated stats), a Trust section, and a chat preview section.

## Known gaps (by design, given this environment)

- No real file upload/OCR — verification "documents" are still just a type
  + reference string, as in the original prototype.
- No live government registry integration.
- Messaging is request/response against localStorage, not WebSockets — the
  service boundary (`chatService.js` / `conversationService.js`) is shaped
  so a real-time transport can be dropped in without changing the API.
- No server-side enforcement of any of this — see `README.md` for the
  production-hardening list, which still applies in full.

---

# Pass 3: Harry — conversational assistant, voice, and hourly movement

This pass only touches the existing Harry character/assistant. No other
page, route, service, or piece of UI was changed.

## Files added

- `src/harry/harryMovementController.js` — the single, app-wide hourly
  walking scheduler (module-level singleton, not per-render/per-mount).
  Encodes `HARRY_WAIT_INTERVAL` (1 hour) and `HARRY_WALK_DURATION`
  (2 minutes) exactly as specified, with a commented-out `HARRY_TEST_MODE`
  flag (10s / 20s) for local smoke-testing only — left `false`. Exposes
  `init()`, `subscribe()`, `getSnapshot()`, and `setBusy()` so the widget
  can pause a walk while Harry is mid-conversation without ever creating a
  second timer.
- `src/harry/useHarrySpeech.js` — thin hook around the browser-native
  `SpeechRecognition`/`webkitSpeechRecognition` and `speechSynthesis` APIs.
  No API key required. Handles unsupported browsers, permission denial,
  no-speech, and recognition errors without throwing, and never overlaps
  speech utterances.
- `src/harry/assets/harry-full.png`, `src/harry/assets/harry-face.png` —
  the two character renders provided for this task; full-body version is
  the roaming/floating character, the headshot is used in the chat header.

## Files modified

- `src/services/harryService.js`
  - Added a general-conversation layer (`GENERAL_CATEGORIES` +
    `matchGeneralIntent`) that recognizes clusters of naturally-worded
    small talk (greetings, "what's up", "how are you", boredom,
    "tell me something interesting", "I don't know what to do", "what can
    you help with", opinions, "explain that simply", "let's talk", thanks,
    farewells, identity questions) with several randomized replies per
    category — not a hardcoded `if message === "..."` chain. This runs
    *after* the existing opportunity-intent checks, so opportunity
    requests are never shadowed by small talk, and *before* the final
    fallback, so unrecognized input still gets a warm, useful reply
    instead of a dead end.
  - Fixed a pre-existing regex bug where `"something in"` could
    accidentally match inside words like "interesting" and misroute small
    talk ("tell me something interesting") into the opportunity-filter
    path.
  - `how_it_works` now also mentions that Harry can just chat.
  - No changes to `matchingService`, task/application data access, or any
    match-score computation — all opportunity data and scoring still come
    from the real `taskService` / `matchingService` / `applicationService`.
- `src/harry/HarryWidget.jsx` — rebuilt as a floating character with a
  clean state machine (`idle | listening | thinking | talking | walking`):
  - Default position bottom-right; roams between four predefined safe
    corners (`harryMovementController.HARRY_POSITIONS`) once an hour for
    exactly two minutes, then stops, using a CSS `top`/`left` transition
    whose duration is driven directly by `HARRY_WALK_DURATION` (so test
    and production timings both animate correctly).
  - Remains clickable during walking; clicking always opens the same
    existing chat panel and does not reset or duplicate the walking timer.
  - While the panel is open, the floating character is replaced by Harry's
    avatar inside the chat header (existing panel/messages/opportunity
    cards markup is otherwise unchanged) so there's never two Harrys on
    screen at once; the header shows a listening/thinking/talking ring
    indicator instead.
  - Added a microphone button (speech-to-text via `useHarrySpeech`) and a
    speaker toggle (text-to-speech), both degrading gracefully when the
    browser doesn't support them.
  - Mid-interaction (listening/thinking/talking) is reported to the
    movement controller via `setBusy`, so an hourly walk due during a
    conversation waits until Harry is free again rather than interrupting
    speech or the chat.
- `src/index.css` — additive Harry-only rules for the new floating
  character, its state-based idle/walking animations, the header's
  listening/thinking/talking ring, and the microphone button; existing
  panel/message/opportunity-card styling kept as-is.

## What was intentionally left alone

- The rest of the website (navbar, dashboards, marketplace, cards,
  layouts, routing) — untouched.
- `matchingService.js` and its 40/25/20/15 weighting — untouched; Harry
  still calls `calculateMatch()` directly for every score it shows.
- No second chatbot, no second Harry, no second matching or opportunity
  data source was created.

---

# Pass 4: Real AI-powered Harry, live opportunity grounding, voice, and visual upgrade

This pass makes Harry genuinely AI-powered instead of purely rule-based,
while keeping every precise data operation (which opportunities exist,
match scores, applying, application status) on the existing deterministic
engine. No other page, route, or service was changed.

## Two-layer architecture (new)

- **Layer 1 — deterministic** (`harryService.js`'s `getHarryResponse`,
  `matchingService.calculateMatch`, `taskService`, `applicationService`):
  unchanged in spirit, still the single source of truth for opportunity
  data, scores, and actions. `ACTION_INTENTS` (find opportunities, apply,
  check status, recite a task's stored fields, state a skill/hours) are
  answered by this layer exactly as before — a language model has no
  business paraphrasing a reward amount or a deadline.
- **Layer 2 — real AI model** (`harry/harryAIProvider.js` +
  `backend/server.js`'s `POST /api/harry/chat`, calling
  `claude-sonnet-4-6` via the Anthropic Messages API): now handles every
  open-ended/reasoning intent — general conversation, "what skills do I
  need for X", skill-gap analysis, learning plans, career direction,
  resume help, internship-readiness, project ideas, hackathon prep, and
  "why is this a good match" explanations. It is explicitly instructed to
  use its own general knowledge for anything outside the student's
  profile (so "what skills do I need for DevOps?" gets a real DevOps
  answer, not "that's not in your profile"), while treating the student's
  profile as *personalization*, never a restriction.
- Every Layer 2 call is **grounded**: the backend receives the current
  live opportunities (same records `taskService.getPublishedTasks()`
  returns to the marketplace), a short "grounding" string of facts Layer 1
  already computed (skill-gap category numbers, the exact task cards
  chosen, a computed match score/explanation), and the recent conversation
  history. The model is told these facts are true and not to invent
  opportunities, organizations, deadlines, rewards, or match percentages
  beyond them. If nothing in the real data fits, it's instructed to say so
  honestly.
- If `AI_API_KEY`/`ANTHROPIC_API_KEY` isn't set, or the call fails/times
  out, Harry silently falls back to Layer 1's own deterministic reply —
  the student never sees an error and nothing here can ever invent
  opportunity data, since that surface never leaves Layer 1.

## Intent-parsing fix

`parseInput()` previously matched generic phrasing like *"What skills do I
need?"* or *"What skills do I need for DevOps?"* into a task-specific
`detail_required_skills` intent, which only makes sense when an actual
task is being discussed — it would incorrectly ask "which opportunity do
you mean?" instead of answering. Task-detail intents now require either an
active task in the conversation (`context.activeTaskId`) or an explicit
reference ("this task/opportunity/it") before they fire; everything else
falls through to the real AI layer. `why_match` detection was also
broadened to catch phrasing like *"Why is this good for me?"* and a bare
*"Why?"* follow-up, not just messages containing the literal word "match".

## Files changed/added

- `backend/server.js` — `/api/harry/chat` rewritten: richer, explicit
  system prompt (general knowledge, dynamic skill-gap reasoning, live
  opportunity grounding, anti-hallucination rules), accepts
  `opportunities`/`history`/`grounding`, builds a sanitized
  user/assistant-alternating message list for the Messages API.
- `src/harry/harryAIProvider.js` — sends opportunities, conversation
  history, and grounding facts alongside the student profile subset.
- `src/services/harryService.js` — added `ACTION_INTENTS` routing,
  `buildGroundingNotes()`, `compactOpportunities()`, and rewrote
  `getHarryReply()` around the two-layer split described above;
  `createInitialContext()` now carries a capped `history` array.
- `src/harry/useHarrySpeech.js` — Harry now picks and caches ONE
  consistent voice from a male-voice name-preference list (with a
  labeled-"male" heuristic fallback) the first time voices load, and
  reuses it for every utterance, with a slightly lower pitch/rate for a
  warmer, less robotic delivery. There was already only one
  `SpeechSynthesisUtterance` call site in the app, so there was no literal
  double-audio bug — this pass makes the single voice used *consistent*
  rather than left to the browser default.
- `src/harry/assets/harry-full.png`, `harry-face.png` — regenerated from
  the character reference image you provided: background removed via
  connected-component flood fill (not a naive color-key, so it doesn't
  eat into similarly-light clothing), then tightly cropped. Both are true
  transparent PNGs (verified against a checkerboard composite), so Harry
  no longer sits inside a visible rectangle.
- `src/index.css` — floating character and header-avatar rules reworked
  for the new transparent art (drop shadow + soft ground shadow instead of
  a background box, a talking micro-animation on both the floating
  character and the chat-header avatar, larger tap target).
- `src/harry/HarryWidget.jsx` — updated quick-suggestion chips and intro
  line to match the requested prompts and to say Harry is AI-powered.

## Known limitation (by design, honestly stated)

No 3D asset (GLB/GLTF) was provided, so Harry is not a real 3D character —
per the instructions for this pass, we didn't fake one. The transparent
PNG + animation layer is built so a GLB could be dropped into
`HarryWidget.jsx` in place of the `<img>` without touching the
conversation/voice logic.

## What was intentionally left alone in this pass

Verification badges, organization dashboard, student dashboard, and
general site-wide spacing/typography polish were reviewed but not changed
in this pass, per the instruction not to redesign working pages
unnecessarily; `IMPLEMENTATION_NOTES.md` Pass 2 already covers the
existing verification UI.
