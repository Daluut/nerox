# Nerox

An intelligent project workspace: organise work, see each project's health with the evidence behind it, and catch knock-on effects before a deadline slips.

This repository contains the functional foundation plus Nerox's four signature features: **Pulse** (project health), **What If?** (try a change before you make it), **Memory** (learning from finished projects) and **Nerox AI** (in-app help).

## Stack

- **Next.js 15** (App Router, server components, server actions) + **TypeScript**
- **Supabase**: Postgres, Auth, Realtime. Authorisation is enforced in the database with row-level security.
- **Tailwind CSS v4** with a token-based dark theme (`src/app/globals.css`)
- **Zod** for server-side validation, **dnd-kit** for the board
- **Vitest** + **PGlite** for unit and database tests, **Playwright** for the end-to-end workflow

## Guides

- [docs/domain.md](docs/domain.md): putting Nerox online and connecting `nerox.cc`
- [docs/payments.md](docs/payments.md): switching on Stripe payments, step by step
- [docs/pulse.md](docs/pulse.md): how the Pulse health score works

## Your brand details

Everything shown on the public **home**, **About us**, **Pricing** and **Contact** pages comes from one file: `src/config/site.ts`: the brand story, what makes Nerox different, the founder's bio and quote, LinkedIn, Instagram (@neroxhq), contact email and the plans and prices. Edit that file to change any of it.

## What's implemented

**Public website** (always in the dark "Nerox night" look)
- Home page with:
  - an animated hero: the pulse line draws into a live health reading over a real screenshot;
  - product showcases for Pulse, What If?, Memory and Nerox AI;
  - an interactive What If? demo (delay a task and watch linked work move past the deadline);
  - Memory estimate bars and a Nerox AI replay;
  - how it works, security, the founder's quote, FAQ, Instagram and a final call to action.
- Pages for Pricing (monthly/yearly switch, comparison table), About us (story, why Nerox is different, the founder and vision), Security and privacy, and Contact.
- Real product screenshots in `public/product/` (WebP, 20–75 KB each), served through `next/image`.
- Motion is CSS plus small client components (no animation library). It respects `prefers-reduced-motion`, and demos play once when scrolled into view.
- SEO: canonical URLs, `sitemap.xml`, `robots.txt` and a generated social preview image, all from `NEXT_PUBLIC_SITE_URL`.

**Look and feel (inside the app)**
- Three colour themes chosen by each person: **Light** (default), **Dark** and **Nerox** (deep blue-purple). Pick one from the sidebar or Settings; it's remembered on that device and applied without a flash.
- Each part of the app has its own colour (Home, My Tasks, Projects, Pulse, Team…), large buttons and roomy layouts.
- Navigation grouped into short sections: Home / My Tasks / Projects, Insights, People, and Nerox (About, Contact).
- A guided **tutorial** on first sign-in that highlights each area in turn. It's saved per user and can be replayed from the ? button.
- Public site: a home page, **About us** (story, mission, values, founder with LinkedIn button) and **Contact** (email, LinkedIn, and a form that opens the visitor's email app).

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
- Home: three clickable summary cards, your next tasks, your projects, and the single most important Pulse finding. Upcoming dates and recent activity live on the separate **Updates** page so Home stays simple.
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
- Admins can adjust weights in Settings, with a plain-English explanation of what each weight means and what it doesn't change.
- Risks that block other work link straight to a What If? simulation of the delay.

**What If?** (`src/lib/whatif/`)
- Build a scenario from one or more changes: a task runs late, takes longer, finishes early, changes hands, someone is away, or the deadline moves.
- Delays follow dependency links (using any slack before the next task starts), and the results show which tasks move, the new finish date against the deadline, affected milestones, workload changes and the health score before and after.
- Scenarios can be saved and are re-run on current data when opened. **Apply** writes all the date and assignee changes in one database transaction, and refuses if the project changed since the simulation ran.

**Memory** (`src/lib/memory/`)
- Learns from completed projects: how long kinds of work (testing, design, writing…) really take compared with estimates, which kinds of work tend to finish late or block others, and how close projects land to their deadlines.
- A lesson only appears with enough evidence (at least 5 tasks across 2 projects) and always shows how many tasks it is based on. Lessons can be dismissed.
- Editable retrospectives per finished project, and estimate suggestions when creating a new project.

**Nerox AI** (`src/lib/ai/`, `src/lib/actions/ai.ts`)
- A floating "Ask Nerox AI" helper on every page. With `ANTHROPIC_API_KEY` set it answers using Claude with context about the current page and the person's projects; without a key it answers from the built-in help guide. Answers are labelled with where they came from. Rate limited per user.

**Plans and payments** (`src/lib/billing/`, see [docs/payments.md](docs/payments.md))
- Free: every core feature, up to 5 people per workspace. Pro (£6 per person a month, or £60 a year): unlimited people, full Nerox AI answers, CSV export and priority support.
- Stripe Checkout for upgrades and Stripe's customer portal for cards, invoices and cancelling. Seats follow the number of active members.
- Paid access comes only from verified webhooks (`/api/stripe/webhook`), written through a database function that only the service role can call. The success page never grants access.
- Payments stay switched off until Stripe is configured. Until then the site shows Pro as "Coming soon", and nothing is limited (early access).

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com) (or run locally with the Supabase CLI), then apply the schema:

```bash
# Option A: Supabase CLI
npx supabase link --project-ref <your-project-ref>
npx supabase db push

# Option B: in the SQL editor, run each file in supabase/migrations/ in order:
#   20261017000000_init.sql, 20261018000000_whatif_memory.sql, 20261019000000_billing.sql
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
| `ANTHROPIC_API_KEY` | no | Turns on AI answers in Nerox AI. Server-only; never exposed to the browser. |
| `NEROX_AI_MODEL` | no | Claude model for Nerox AI (default `claude-haiku-5-5`) |
| `STRIPE_SECRET_KEY` | for payments | Stripe secret key. Server only. |
| `STRIPE_WEBHOOK_SECRET` | for payments | Signing secret of the webhook endpoint |
| `STRIPE_PRICE_PRO_MONTHLY` | for payments | Stripe price ID for Pro, monthly, per person |
| `STRIPE_PRICE_PRO_YEARLY` | no | Stripe price ID for Pro, yearly, per person |
| `SUPABASE_SERVICE_ROLE_KEY` | for payments | Used only by the Stripe webhook and seat syncing. Server only; never prefix with `NEXT_PUBLIC_`. |

Every query from the app runs as the signed-in user, under row-level security. The one exception is billing: the Stripe webhook has no signed-in user, so it writes subscription state with the service-role key, through a single database function.

## Tests

```bash
npm run typecheck
npm run lint
npm run test:unit   # dates, dependency graph, permissions, progress, templates, Pulse, What If?, Memory, help search,
                    # plan rules, Stripe webhook mapping and signature checks, CSV export
npm run test:db     # applies the real migration to an in-process Postgres (PGlite) and tests RLS,
                    # workspace isolation, triggers, invitations, roles, notifications, snapshots
npm run test:e2e    # full workflow in a browser against a running app (see below)
```

The end-to-end test needs the app running against a Supabase project with email confirmation off, and a Chromium (`npx playwright install chromium`, or set `CHROME_PATH`):

```bash
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

It registers, creates a workspace and a templated project, invites a second user who signs up through the link, assigns work (and checks the notification), checks cycle prevention, completes a task, moves a board card and confirms it persists, reads Pulse, takes the tour, runs, saves and applies a What If? scenario, opens Memory, asks Nerox AI, checks that another workspace's user can't open the project by URL, and exercises the mobile navigation.

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
src/lib/whatif/           the What If? simulation engine
src/lib/memory/           the Memory learning engine
src/lib/ai/               Nerox AI help guide and search
src/lib/billing/          plan rules, Stripe client, webhook mapping, seat sync
src/components/marketing/ public-site components: hero, demos, pricing cards, FAQ
src/config/site.ts        brand, founder, socials, plans and prices
docs/                     domain, payments and Pulse guides
src/lib/data/             session/workspace context, queries, row mappers, shared view shapes
src/lib/actions/          server actions — every write is validated with Zod and runs under RLS
src/components/           design system (ui/), app shell, tasks, projects, Pulse
src/app/                  routes: (auth), onboarding, invite, (app)/…
tests/unit, tests/db, tests/e2e
```

## Known limitations

- **Payments haven't been run against Stripe's real servers.** The flow was tested against the real webhook route and database with signed events and a local stand-in for Stripe's API. Follow the test-mode checklist in `docs/payments.md` before going live.
- **The Free member limit counts at invitation time** (active members plus pending invites). A workspace that drops from Pro to Free keeps everyone already in it, but can't invite more.
- **No terms of service or privacy policy yet.** You need both before taking payments.
- **Nerox AI** needs an `ANTHROPIC_API_KEY` for free-form answers; without one it matches questions against the help guide. Its rate limit is kept in memory per server instance.
- **What If?** treats task dates as calendar days (no weekends or holidays) and doesn't model individual capacity. Moving due dates later can raise the health score because fewer tasks count as overdue; the page explains this when it happens.
- **Memory** recognises kinds of work from keywords in task titles, and needs actual effort recorded on completed tasks for estimate lessons.
- **Conversation-to-tasks** isn't built.
- Pulse's dependency factor is a **simplified heuristic** (blocked chains, impossible orderings, unstarted bottlenecks), not critical-path analysis. Individual **capacity isn't tracked**, so workload balance compares outstanding work only. Weights and thresholds are product defaults, not empirically validated.
- Pulse history is recorded when a project is viewed (one snapshot per day); days nobody opens the project have no snapshot. A scheduled job would fill those in.
- Board columns are the five fixed statuses; within a column, cards sort by priority then due date (no manual ordering).
- Attachments, @mentions, notification preferences and email notifications aren't implemented.
- The contact form doesn't send email itself; it opens the visitor's email app with the message filled in, so no email service is needed.
- Realtime refreshes the page's server data when something changes; there's no per-field merge, so two people editing the same text field at once means the last save wins.
- The end-to-end suite was run against a local stack built from Supabase's own Auth (GoTrue) and PostgREST services on Postgres 16, without Realtime. Live updates haven't been exercised in an automated test.
