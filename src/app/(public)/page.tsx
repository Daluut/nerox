import Link from "next/link";
import { Activity, ArrowRight, CheckSquare, FolderKanban, GitBranch, GraduationCap, Rocket, Users } from "lucide-react";
import { SITE } from "@/config/site";
import { Avatar, ButtonLink, IconBadge } from "@/components/ui/primitives";
import { LinkedinIcon } from "@/components/ui/linkedin-icon";

const FEATURES = [
  { icon: <FolderKanban className="size-5" />, color: "var(--c-projects)", title: "Plan in minutes", body: "Start from a template, drag tasks across a board, and see everything on a timeline." },
  { icon: <CheckSquare className="size-5" />, color: "var(--c-tasks)", title: "Know what's yours", body: "My Tasks pulls your work from every project into one list, most urgent first." },
  { icon: <Activity className="size-5" />, color: "var(--c-pulse)", title: "A health check for every project", body: "Pulse scores each project and tells you why: what's late, what's stuck, who's overloaded." },
  { icon: <GitBranch className="size-5" />, color: "var(--c-whatif)", title: "See the knock-on effects", body: "Link tasks that depend on each other, so one delay never surprises you." },
];

const AUDIENCES = [
  { icon: <GraduationCap className="size-5" />, color: "var(--c-tasks)", title: "Student teams", body: "Group coursework and software projects with a hard hand-in date." },
  { icon: <Rocket className="size-5" />, color: "var(--c-memory)", title: "Start-ups and small businesses", body: "Launches, client work and everything in between." },
  { icon: <Users className="size-5" />, color: "var(--c-team)", title: "Project leads", body: "Anyone who needs to know early whether a deadline is still realistic." },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "radial-gradient(60% 50% at 80% 10%, var(--violet-soft), transparent), radial-gradient(40% 40% at 10% 90%, var(--cyan-soft), transparent)" }}
        />
        <div className="relative mx-auto grid max-w-[1180px] items-center gap-12 px-5 py-16 md:py-24 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-[13px] font-medium text-muted">
              <span className="size-2 rounded-full bg-success" /> Free while in early access
            </p>
            <h1 className="mt-5 text-[44px] font-bold leading-[1.05] tracking-tight md:text-[58px]">{SITE.tagline}</h1>
            <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-muted">{SITE.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup" variant="primary" size="lg">
                Get started free <ArrowRight className="size-5" />
              </ButtonLink>
              <ButtonLink href="/about" variant="secondary" size="lg">
                Learn about us
              </ButtonLink>
            </div>
          </div>
          <ProductSketch />
        </div>
      </section>

      {/* How it works — a real sequence, so it's numbered */}
      <section className="mx-auto max-w-[1180px] px-5 py-16">
        <h2 className="text-[30px] font-bold tracking-tight">How it works</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Create a project", "Pick a template or start blank. Add a deadline and invite your team."],
            ["Add and share the work", "Give each task an owner and a due date. Drag it across the board as it moves."],
            ["Let Pulse watch it", "Check the health score any time. Every warning comes with the reason and a next step."],
          ].map(([t, b], i) => (
            <li key={t} className="rounded-2xl border border-line bg-panel p-6 shadow-card">
              <span className="flex size-10 items-center justify-center rounded-xl bg-violet text-[17px] font-bold text-white">{i + 1}</span>
              <p className="mt-4 text-[18px] font-semibold">{t}</p>
              <p className="mt-1.5 text-[15px] text-muted">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="bg-sidebar py-16">
        <div className="mx-auto max-w-[1180px] px-5">
          <h2 className="text-[30px] font-bold tracking-tight">Everything you need, nothing you don&apos;t</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4 rounded-2xl border border-line bg-panel p-6 shadow-card">
                <IconBadge color={f.color} size={44}>
                  {f.icon}
                </IconBadge>
                <div>
                  <p className="text-[18px] font-semibold">{f.title}</p>
                  <p className="mt-1 text-[15px] text-muted">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audience */}
      <section className="mx-auto max-w-[1180px] px-5 py-16">
        <h2 className="text-[30px] font-bold tracking-tight">Made for teams like yours</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="rounded-2xl border border-line bg-panel p-6 shadow-card">
              <IconBadge color={a.color} size={44}>
                {a.icon}
              </IconBadge>
              <p className="mt-4 text-[18px] font-semibold">{a.title}</p>
              <p className="mt-1 text-[15px] text-muted">{a.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Founder */}
      <section className="mx-auto max-w-[1180px] px-5 pb-16">
        <div className="flex flex-col gap-6 rounded-3xl border border-line bg-panel p-8 shadow-card md:flex-row md:items-center">
          <Avatar name={SITE.owner.name} size={72} />
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-violet">Founded by {SITE.owner.name}</p>
            <p className="mt-1 max-w-2xl text-[19px] font-semibold leading-snug">{SITE.owner.vision[0]}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/about#founder" variant="secondary">
              Read the story
            </ButtonLink>
            <a
              href={SITE.owner.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0a66c2] px-5 text-[15px] font-semibold text-white hover:brightness-110"
            >
              <LinkedinIcon className="size-4" /> Connect
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1180px] px-5 pb-20">
        <div className="rounded-3xl bg-violet px-8 py-12 text-white md:px-14">
          <h2 className="max-w-xl text-[32px] font-bold leading-tight tracking-tight">Start your first project in under five minutes.</h2>
          <p className="mt-3 max-w-xl text-[17px] text-white/80">No credit card. A short tour shows you around the first time you sign in.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex h-13 items-center gap-2 rounded-xl bg-white px-7 text-[16px] font-semibold text-[#3b1fd1] hover:bg-white/90">
              Create my account <ArrowRight className="size-5" />
            </Link>
            <Link href="/contact" className="inline-flex h-13 items-center rounded-xl border border-white/40 px-7 text-[16px] font-semibold text-white hover:bg-white/10">
              Talk to us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/** A drawn illustration of the product, clearly labelled as an example. */
function ProductSketch() {
  const cols = [
    { name: "To do", color: "var(--c-tasks)", cards: ["Write report intro", "Design the logo"] },
    { name: "Doing", color: "var(--warning)", cards: ["Build sign-up page"] },
    { name: "Done", color: "var(--success)", cards: ["Pick a topic", "Set the deadline"] },
  ];
  return (
    <figure className="relative" aria-label="Illustration of a Nerox project board and health score">
      <div className="rounded-3xl border border-line bg-panel p-5 shadow-[0_30px_80px_-20px_var(--violet-soft)]">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold">Example project</p>
          <span className="rounded-full bg-success-soft px-3 py-1 text-[13px] font-semibold text-success">On track</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {cols.map((c) => (
            <div key={c.name} className="rounded-xl bg-raised p-2.5">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted">
                <span className="size-2 rounded-full" style={{ background: c.color }} />
                {c.name}
              </p>
              <div className="flex flex-col gap-2">
                {c.cards.map((t) => (
                  <div key={t} className="rounded-lg border border-line bg-panel p-2 text-[12px] leading-snug">
                    {t}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-16 -left-4 w-[230px] rounded-2xl border border-line bg-panel p-4 shadow-card md:-left-10">
        <p className="text-[12px] font-semibold text-c-pulse">Pulse</p>
        <p className="mt-1 text-[14px] font-semibold leading-snug">“Build sign-up page” is due tomorrow and 2 tasks wait on it.</p>
      </div>
    </figure>
  );
}
