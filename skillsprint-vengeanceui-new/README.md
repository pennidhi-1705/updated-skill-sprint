# SkillSprint

**Small tasks. Real experience. Local impact.**

A React + Vite hackathon-ready prototype with a backend/API scaffold and Neon PostgreSQL schema.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

Optional API server:

```bash
cp .env.example .env
# add DATABASE_URL only when you have a Neon database
npm run server
```

## Prototype behavior

- Student and organization registration use localStorage so entered information remains connected throughout the prototype.
- Opportunity records have stable IDs and task detail pages return a real not-found state for unknown IDs.
- Student, organization, and internal-review portals are role-separated inside the same app; navigation and guarded routes never mix portal content. The internal review console (`/admin`, role-gated) is never linked from student or organization navigation.
- Organization-posted tasks are stored once and read by both the organization dashboard and student marketplace; students only see tasks from verified organizations.
- Applications carry the exact studentId, taskId, and organizationId; organizations only receive applications belonging to their own tasks.
- Organization verification runs through an AI-assisted pipeline (`src/services/aiVerificationService.js` + `src/services/governmentVerificationService.js`) automatically on registration/resubmission. Both are clearly-labeled simulations — no real OCR or government API is wired in — see `IMPLEMENTATION_NOTES.md` for what to replace before production.
- Students can follow verified organizations and message them once they've applied to an opportunity (organizations can widen this from their profile). Conversations and notifications are stored the same way as everything else in this prototype — localStorage, not a real-time transport.
- Selecting an application creates/reuses one project using those same task, student, and organization IDs; rejecting never creates a project.
- Student submissions and organization reviews reference the exact project; review feedback/status is synchronized back to the student view.
- Completion creates review data from the actual project.
- Matching is deterministic and transparent; no random match percentages are generated.
- Demo marketplace data is seeded only when no task data exists and does not overwrite registered users or later-created tasks.
- The database schema and API scaffold keep Neon credentials out of frontend code.

## Production hardening still needed

For deployment, replace localStorage authentication with secure server-side sessions/password hashing, enforce authorization in API middleware, add real file/object storage, connect the frontend services to API endpoints, wire the AI verification and government-record services to real providers (OCR/LLM + an official registry API), move chat to a real-time transport (e.g. Socket.IO/WebSockets), and add the remaining internal moderation/report/dispute API operations.
