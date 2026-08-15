> INSTRUCTIONS FOR AI AGENTS: Before starting any task, read this file — 
> especially the most recent 3-5 entries — to understand exactly what 
> the last agent(s) did, including which files/scope they touched. 
> After completing any change that required modifying code, append a 
> new entry here with the fields below.
>
> Before modifying a file another agent recently touched (per this log 
> or git history), briefly verify the current state of that file 
> matches what the log describes — do not assume the log is 
> authoritative over the actual code.

- NOTE: Keep entries newest-first. When appending a log entry, prepend it so the most recent entries appear immediately after this instruction block and notes.

---

### Entry

- Date & Time: 2026-08-15 13:45 UTC
- User: Repository maintainer (prompt provided in session)
- Agent: Copilot
- Model: not disclosed
- Prompt Summary: Move post composer actions to a fixed bottom footer and hide the floating bottom navigation while composing posts.
- Changes Made:
  - Modified `web/components/post-screen.tsx` to remove action buttons from the top header and render attach/settings and Post controls in a bottom footer.
  - Updated `web/app/globals.css` to hide the floating `.bottom-nav` when `.post-screen` is present and added styles for `.post-footer` and spacing adjustments.
- Files/Scope Touched:
  - web/components/post-screen.tsx (modified)
  - web/app/globals.css (modified)
- Reason/Decision: The composer needs dedicated bottom-aligned actions for a clearer UX on mobile; hiding the floating nav during composition prevents control conflicts.
- Notes for next agent:
  - Confirm the footer does not overlap important content on small viewports; adjust `width` and `padding-bottom` in `globals.css` if necessary.
  - Remember to remove or gate `/dev-settings` before production.
- Verified Working?: yes — verified in local dev server at `/dev-settings` and composer view.

---

### Entry

- Date & Time: 2026-08-15 12:56 UTC
- User: Repository maintainer (prompt provided in session)
- Agent: Copilot
- Model: not disclosed
- Prompt Summary: Repair the local development environment so frontend login/signup works — diagnose and fix API build/run issues, start the API server, and verify routes. Also continue previously requested UI edits and doc housekeeping.
- Changes Made (actions performed):
  - Created `web/app/dev-settings/page.tsx` to render the Settings UI without backend auth.
  - Modified `web/components/account-screens.tsx` to remove the Settings header icon/heading/description and keep tab markup.
  - Fixed CSS duplication and spacing in `web/app/globals.css` so styles compile.
  - Deleted `codex.md` and `copilot.md` from the repository.
  - Ran package installation for the API and attempted multiple builds; rebuilt and ran the API using `ts-node` for iteration, then compiled and started the built server when necessary.
  - Committed all changes (commit 383b617).
- Files/Scope Touched (exact paths):
  - CHANGELOG.md
  - AGENTLOG.md
  - web/app/dev-settings/page.tsx (created)
  - web/components/account-screens.tsx (modified)
  - web/app/globals.css (modified)
  - codex.md (deleted)
  - copilot.md (deleted)
- Commands run (high-level):
  - `npm install` (api)
  - `npm run start:dev` and `node -r ts-node/register src/main.ts` (api) for iterative testing
  - `npm run build` (api) and `node dist/src/main.js` when verifying compiled output
  - `npm run dev:local` (web) to run Next dev server
  - `git add -A` / `git commit -m "chore(docs/ui): ..."` (commit 383b617)
- Reason/Decision: The frontend depends on a running API (default NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api). To allow real login/signup flows to be tested, the API must run locally; fixes addressed build/runtime issues and a CSS compile error that broke the dev web build. The dev-only `dev-settings` page was added to allow designers to iterate the Settings UI without backend dependencies.
- Notes for next agent:
  - The API should be started in dev mode during local work: `cd api && npm run start:dev` (ensure `.env` is present and `DATABASE_URL` reachable). If the compiled `dist` is used, run `npm run build` then `node dist/src/main.js`.
  - The `/dev-settings` route is development-only and should be removed or gated before production release.
  - Commit 383b617 contains the doc and UI changes; review that commit if further edits are required.
  - If database migrations are required, run `npm run db:migrate` in `api` (requires `DATABASE_URL` and `drizzle` configured).
- Verified Working?: yes — Next dev server loads `/dev-settings`; API process started locally and basic endpoints are reachable (development verification performed).

---

### Entry

- Date & Time: 2026-08-15 13:18 UTC
- User: Repository maintainer (prompt provided in session)
- Agent: Copilot
- Model: not disclosed
- Prompt Summary: Prepare the Nest API to run on Vercel serverless functions and add serverless wrapper and Vercel configuration.
- Changes Made:
  - Modified `api/src/database/database.module.ts` to reuse a global `pg` Pool to prevent connection exhaustion in serverless environments.
  - Added `api/api-handler.ts` as a `serverless-http` wrapper that boots the Nest app and exposes the Express instance to Vercel.
  - Added `serverless-http` to `api/package.json` dependencies.
  - Added `vercel.json` to the repository to route `/api/*` to the serverless handler and build the `web` Next project.
- Files/Scope Touched:
  - api/src/database/database.module.ts (modified)
  - api/api-handler.ts (added)
  - api/package.json (modified)
  - vercel.json (added)
- Reason/Decision: Converting the API to a serverless-compatible entrypoint allows deploying both frontend and backend on Vercel. Using a global Pool mitigates connection issues with Neon/Postgres.
- Notes for next agent:
  - Set Vercel Project envs: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SIGNUP_OTP_ENABLED`, and `NEXT_PUBLIC_API_BASE_URL` (pointing to deployed Vercel domain).
  - Add CI workflow to run `npm --prefix api run db:migrate` using secrets for `DATABASE_URL` after deploy.
  - Before shipping, remove or gate `/dev-settings` route.
- Verified Working?: untested — serverless behavior must be validated in a Vercel preview deployment.

---

### Entry

- Date & Time: 2026-08-15 13:30 UTC
- User: Repository maintainer (prompt provided in session)
- Agent: Copilot
- Model: not disclosed
- Prompt Summary: Mark repository as ready for Vercel deployment and instruct next agent/user on verification steps.
- Changes Made: Added deployment-ready notes to `CHANGELOG.md` and recorded necessary Vercel environment variables and migration instructions. No code changes in this step.
- Files/Scope Touched:
  - CHANGELOG.md (modified)
  - AGENTLOG.md (modified)
- Reason/Decision: Provide clear handoff for deployment — make it straightforward for a product manager or another agent to push the repo and validate deployment on Vercel.
- Notes for next agent/user:
  - Push commits to GitHub and import the repo in Vercel.
  - Set environment variables listed in the changelog.
  - Run migrations via CI/GitHub Actions or a trusted runner: `npm --prefix api run db:migrate`.
  - Validate `/api/auth/login` returns expected responses and the Next frontend uses `NEXT_PUBLIC_API_BASE_URL` to call the API.
- Verified Working?: n/a — waiting for your deployment and verification.


---

---

### Entry

- Date & Time: 2026-08-15 12:20 UTC
- User: Repository maintainer (prompt provided in session)
- Agent: Copilot
- Model: GPT-5 mini
- Prompt Summary: Add an agent-sync note to `CHANGELOG.md`, update the Current State, add a dated `2026-08-15` changelog entry, and create/modify files to allow offline cosmetic edits to the Settings UI.
- Changes Made: Updated `CHANGELOG.md` with an explicit instruction to update `AGENTLOG.md` whenever the changelog is changed; updated the `Current State` and appended a dated changelog entry for 2026-08-15. Created `web/app/dev-settings/page.tsx` and modified `web/components/account-screens.tsx` and `web/app/globals.css` to remove the Settings header content and position the tab bar under the header for cosmetic editing. Fixed a duplicated CSS block introduced while adjusting spacing.
- Files/Scope Touched:
  - CHANGELOG.md
  - AGENTLOG.md
  - web/app/dev-settings/page.tsx (created)
  - web/components/account-screens.tsx (modified)
  - web/app/globals.css (modified)
- Reason/Decision: Provide a simple, reproducible way for frontend designers/agents to preview and edit the Settings UI without requiring a running backend. Keep changelog and agent log synchronized for auditability.
- Notes: The `/dev-settings` route is development-only and should be removed or gated before production. One CSS duplication was fixed during the work which caused a transient build error; the page renders at `/dev-settings` locally.
- Verified Working?: yes

---

### Entry

- Date & Time: 2026-08-15 12:00 UTC
- User: Repository maintainer (prompt provided in session)
- Agent: Copilot
- Model: GPT-5 mini
- Prompt Summary: Add AI agent instruction block to `CHANGELOG.md` and create `AGENTLOG.md` with a seeded entry describing the change.
- Changes Made: Prepended an AI agent instruction block to `CHANGELOG.md`. Created `AGENTLOG.md` with this seeded entry documenting the change.
- Files/Scope Touched:
  - CHANGELOG.md
  - AGENTLOG.md
- Reason/Decision: Provide a concise, agent-friendly changelog workflow to ensure future agents read history and append detailed change logs.
- Notes: No runtime code changes. Current State section in `CHANGELOG.md` left intact for future overwrites.
- Verified Working?: untested

