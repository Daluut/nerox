# Nerox

An intelligent project workspace: organise work, see each project's health with the evidence behind it, and catch knock-on effects before a deadline slips.

This repository contains **Phase 1 (functional foundation)** and **Phase 2 (Nerox Pulse)** from the product brief. What If? (Phase 3) and Memory (Phase 4) are not built yet; their pages say so plainly.

## Stack

- **Next.js 15** (App Router, server components, server actions) + **TypeScript**
- **Supabase**: Postgres, Auth, Realtime. Authorisation is enforced in the database with row-level security.
- **Tailwind CSS v4** with a token-based dark theme (`src/app/globals.css`)
- **Zod** for server-side validation, **dnd-kit** for the board
- **Vitest** + **PGlite** for unit and database tests, **Playwright** for the end-to-end workflow

## What's implemented

**Accounts and workspaces**
- Sign up, sign in, sign out, password reset, session refresh in middleware, protected routes.
- Onboarding: welcome → workspace → first project from a template (Software Project, University Assignment, Startup Launch, General) → editable starting tasks and milestones.
- Multiple workspaces with a switcher. Roles: owner, admin, member, viewer — enforced by RLS policies and security-definer functions, mirrored in `src/lib/domain/permissions.ts` for the UI.
- Single-use, expiring invitation links (only a SHA-256 hash of the token is stored), optional email lock, revocation.
- Role changes and member removal with a clear policy: removed members' **open** tasks become unassigned; completed work and history keep their name.

**Projects and tasks**
- Create (atomically, via one database function), edit, put on hold, complete, archive/restore, delete (typed confirmation).
- Project views sharing the same data: Overview, Board (drag-and-drop plus an accessible status control on every card), List (sort, search, filter), Timeline (planned dates, dependency links, today and deadline lines, milestones), Pulse, Activity.
- Tasks: title, description, status, priority, assignee, start/due dates, estimate, actual effort, milestone, labels, comments, history. Quick-create from anywhere with context prefilled.
- Dependencies as a directed graph. Cycles are rejected in the UI (impossible options aren't offered), in the server action, and by a database trigger (which also covers concurrent edits). Cross-project dependencies are rejected.
- Completion timestamps, status-change times and the activity log are written by database triggers, so they can't be forged by a client.
- My Tasks across projects: Needs attention, Today, Upcoming, Overdue, Completed, All; filters; "created by me for others".
- Overview: portfolio metrics (all clickable), project health list, my priorities, Pulse highlights, next two weeks, recent activity, and a proper empty state for new users.
- In-app notifications for assignment, reassignment, comments on your tasks and completed milestones.
- Global search (Ctrl/⌘+K; it never captures keys while you're typing in a field) across projects, tasks, milestones and people.
- Live updates via Supabase Realtime: when a collaborator changes tasks, comments, dependencies or milestones, open pages refresh.

**Nerox Pulse** (`src/lib/pulse/`) — see [docs/pulse.md](docs/pulse.md)
- A pure, deterministic engine: the same data always gives the same assessment. No AI.
- Seven factors scored 0–100 and combined with configurable weights. Unmeasurable factors are excluded and reported, never treated as perfect.
- Risks with severity, evidence, possible consequence, a suggested next step and links to act; each labelled **observed**, **rule-based** or **forecast**.
- Velocity-based finish forecast only when there's enough history, labelled as an extrapolation.
- One stored snapshot per project per day for history; trends only draw from stored snapshots.
- Risks can be acknowledged (recorded, still counted in the score).
- Admins can adjust weights in Settings.

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com) (or run locally with the Supabase CLI), then apply the schema:

```bash
# Option A: Supabase CLI
npx supabase link --project-ref <your-project-ref>
npx supabase db push

# Option B: paste supabase/migrations/20261017000000_init.sql into the SQL editor and run it
```

In the Supabase dashboard:

- **Authentication → URL Configuration**: set the Site URL to your app URL and add `<your-app-url>/auth/callback` as a redirect URL.
- **Authentication → Providers → Email**: keep "Confirm email" on for production. Turn it off only for local testing.
- **Database → Replication**: the migration adds `tasks`, `task_dependencies`, `comments`, `notifications` and `milestones` to the `supabase_realtime` publication if it exists. If you don't want live updates, set `NEXT_PUBLIC_REALTIME=off`.

### 2. App

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev                  # http://localhost:3000
```

Without Supabase credentials the app shows a setup page instead of pretending to work.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key (public; RLS protects data) |
| `NEXT_PUBLIC_SITE_URL` | recommended | Public app URL for invite links and auth email redirects. Falls back to the request host. |
| `NEXT_PUBLIC_REALTIME` | no | `off` disables live updates |

No service-role key is used anywhere; every query runs as the signed-in user.

## Tests

```bash
npm run typecheck
npm run lint
npm run test:unit   # dates, dependency graph, permissions, progress, templates, Pulse scenarios
npm run test:db     # applies the real migration to an in-process Postgres (PGlite) and tests RLS,
                    # workspace isolation, triggers, invitations, roles, notifications, snapshots
npm run test:e2e    # full workflow in a browser against a running app (see below)
```

The end-to-end test needs the app running against a Supabase project with email confirmation off, and a Chromium (`npx playwright install chromium`, or set `CHROME_PATH`):

```bash
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

It registers, creates a workspace and a templated project, invites a second user who signs up through the link, assigns work (and checks the notification), checks cycle prevention, completes a task, moves a board card and confirms it persists, reads Pulse, checks that another workspace's user can't open the project by URL, and exercises the mobile navigation.

## Deploying

Any Next.js host works; Vercel is the simplest:

1. Import the repository, set the environment variables above (with `NEXT_PUBLIC_SITE_URL` set to the production URL).
2. Add `https://<your-domain>/auth/callback` to Supabase's redirect URLs.
3. Apply the migration to the production database before the first deploy.

## Project layout

```
supabase/migrations/      schema, RLS policies, triggers, transactional functions
src/lib/domain/           pure domain logic: dates, dependency graph, permissions, progress, templates
src/lib/pulse/            the Pulse engine (config, types, engine)
src/lib/data/             session/workspace context, queries, row mappers, shared view shapes
src/lib/actions/          server actions — every write is validated with Zod and runs under RLS
src/components/           design system (ui/), app shell, tasks, projects, Pulse
src/app/                  routes: (auth), onboarding, invite, (app)/…
tests/unit, tests/db, tests/e2e
```

## Known limitations

- **What If?** (scenario simulation) and **Nerox Memory** (learning from completed projects) are not built. Their pages explain what they'll do and, for Memory, show how much real history has been recorded.
- **Conversation-to-tasks** and any AI-generated summaries are not built. Nothing in the app uses an LLM.
- Pulse's dependency factor is a **simplified heuristic** (blocked chains, impossible orderings, unstarted bottlenecks), not critical-path analysis. Individual **capacity isn't tracked**, so workload balance compares outstanding work only. Weights and thresholds are product defaults, not empirically validated.
- Pulse history is recorded when a project is viewed (one snapshot per day); days nobody opens the project have no snapshot. A scheduled job would fill those in.
- Board columns are the five fixed statuses; within a column, cards sort by priority then due date (no manual ordering).
- Attachments, @mentions, notification preferences and email notifications aren't implemented.
- Realtime refreshes the page's server data when something changes; there's no per-field merge, so two people editing the same text field at once means the last save wins.
- The end-to-end suite was run against a local stack built from Supabase's own Auth (GoTrue) and PostgREST services on Postgres 16, without Realtime. Live updates haven't been exercised in an automated test.
