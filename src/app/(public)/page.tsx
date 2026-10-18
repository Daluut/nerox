import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Activity, BookOpen, CalendarRange, CheckSquare, KeyRound, Lock, Radio, ShieldCheck, Sparkles, Split, Users, CreditCard } from "lucide-react";
import { SITE } from "@/config/site";
import { billingEnabled } from "@/lib/billing/config";
import pulseShot from "../../../public/product/pulse.webp";
import timelineShot from "../../../public/product/timeline.webp";
import { HeroShowcase } from "@/components/marketing/hero-showcase";
import { WhatIfDemo } from "@/components/marketing/whatif-demo";
import { MemoryDemo } from "@/components/marketing/memory-demo";
import { AiDemo } from "@/components/marketing/ai-demo";
import { Reveal } from "@/components/marketing/in-view";
import { Faq } from "@/components/marketing/faq";
import { InstagramBand } from "@/components/marketing/instagram-band";
import { LinkedinIcon } from "@/components/ui/linkedin-icon";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  const paid = billingEnabled();
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative -mt-[68px] overflow-hidden pt-[68px]">
        <div aria-hidden className="mk-light pointer-events-none absolute inset-0" />
        <div aria-hidden className="mk-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-[1180px] px-5 pb-28 pt-16 md:pt-24">
          <div className="max-w-[860px]">
            <p className="mk-enter inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[13px] text-muted" style={{ ["--i" as string]: 0 }}>
              <span className="relative flex size-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#43d39e] opacity-60 motion-reduce:hidden" />
                <span className="relative size-2 rounded-full bg-[#43d39e]" />
              </span>
              Free to start, no card needed
            </p>
            <h1 className="mk-display mk-enter mt-6 text-[clamp(42px,7vw,84px)]" style={{ ["--i" as string]: 1 }}>
              Spot a slipping project while there&apos;s still time to fix&nbsp;it.
            </h1>
            <p className="mk-lede mk-enter mt-6" style={{ ["--i" as string]: 2 }}>
              Nerox is a project workspace that reads your team&apos;s tasks for you. It scores each project&apos;s health, explains every risk with the evidence, and shows what a delay would do before you decide.
            </p>
            <div className="mk-enter mt-9 flex flex-wrap gap-3" style={{ ["--i" as string]: 3 }}>
              <Link href="/signup" className="mk-btn mk-btn-primary">
                Start free
              </Link>
              <Link href="#product" className="mk-btn mk-btn-ghost">
                See how it works
              </Link>
            </div>
          </div>
          <div className="mt-24 md:mt-28">
            <HeroShowcase />
          </div>
          <p className="mt-16 text-center text-[13px] text-faint">Real Nerox screens, shown with an example project.</p>
        </div>
      </section>

      {/* ── The idea ─────────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-[1180px] gap-12 px-5 py-20 md:grid-cols-[1fr_1.1fr] md:py-28">
        <h2 className="mk-h2 max-w-[14ch]">Most tools store your tasks. Nerox reads them.</h2>
        <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {[
            ["What's late", "Overdue work, weighted by how much it matters and what's waiting on it."],
            ["What's holding work up", "Tasks that block others, and chains that can't finish in time."],
            ["Who has too much", "Open work per person, so nobody quietly drowns."],
            ["Whether the deadline holds", "A forecast from your real pace, only when there's enough history."],
          ].map(([t, b]) => (
            <div key={t} className="border-t border-white/10 pt-5">
              <dt className="text-[18px] font-semibold">{t}</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-muted">{b}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Product ──────────────────────────────────────────────────────── */}
      <div id="product" className="scroll-mt-24">
        <Showcase
          color="#ff7ac6"
          icon={<Activity className="size-5" />}
          name="Pulse"
          title="A health check you can actually read."
          body="Every project gets a score out of 100 from seven plain checks. Each warning shows the evidence, what could happen next, and the one thing to do about it."
          points={["Facts, rules and forecasts are labelled, so you know what's certain", "Says what it couldn't measure instead of guessing", "Weighting lets your team decide what matters most"]}
          visual={
            <Reveal as="figure" className="mk-frame">
              <div className="mk-frame-bar" aria-hidden>
                <i />
                <i />
                <i />
              </div>
              <Image src={pulseShot} alt="The Pulse tab: a health score of 70, a breakdown of seven factors, and a critical risk with its evidence and suggested next step." sizes="(min-width: 1024px) 640px, 100vw" placeholder="blur" className="h-auto w-full" />
            </Reveal>
          }
        />
        <Showcase
          flip
          color="#b69bff"
          icon={<Split className="size-5" />}
          name="What If?"
          title="Test a decision before you make it."
          body="A task running late, someone on holiday, a deadline moving. Try it out and see which work moves, who's affected and what happens to the finish date. Your real plan only changes when you press Apply."
          points={["Follows the links between tasks, including spare time", "Save scenarios to discuss with your team", "Apply every change at once, or not at all"]}
          visual={<WhatIfDemo />}
        />
        <Showcase
          color="#ffcf5a"
          icon={<BookOpen className="size-5" />}
          name="Memory"
          title="Every project makes the next one better."
          body="Memory looks back at your finished work and finds the patterns, like testing always taking twice as long. When you plan a new project, it suggests better estimates."
          points={["Only speaks up with enough evidence", "Shows exactly which tasks each lesson is based on", "Keep retrospective notes next to the numbers"]}
          visual={<MemoryDemo />}
        />
        <Showcase
          flip
          color="#7c5cff"
          icon={<Sparkles className="size-5" />}
          name="Nerox AI"
          title="Stuck? Ask, right where you are."
          body="Ask how anything works, or why a project is flagged, without leaving the page. Answers always say where they came from: the help guide, or AI that can see a summary of your projects."
          points={["Help guide answers on every plan", "Full AI answers about your own projects on Pro", "Never invents facts about your work"]}
          visual={<AiDemo />}
        />
      </div>

      {/* ── Everyday tools ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1180px] px-5 py-20 md:py-28">
        <h2 className="mk-h2 max-w-[18ch]">And everything you&apos;d expect, done simply.</h2>
        <p className="mk-lede mt-5">Plan on a board, a list or a timeline. They all show the same work, so nothing gets out of sync.</p>
        <Reveal as="figure" className="mk-frame mt-12">
          <div className="mk-frame-bar" aria-hidden>
            <i />
            <i />
            <i />
          </div>
          <Image src={timelineShot} alt="The Timeline view: tasks as bars across weeks, with links between dependent tasks, today's date and the deadline marked." sizes="(min-width: 1200px) 1140px, 100vw" placeholder="blur" className="h-auto w-full" />
        </Reveal>
        <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [<CalendarRange key="i" className="size-5" />, "Board, list and timeline", "Drag cards, sort lists, and see links between tasks."],
            [<CheckSquare key="i" className="size-5" />, "My Tasks", "Your work from every project in one list, most urgent first."],
            [<Users key="i" className="size-5" />, "Roles and invites", "Owners, admins, members and read-only viewers."],
            [<Radio key="i" className="size-5" />, "Live updates", "When a teammate changes something, your page refreshes."],
          ].map(([icon, t, b]) => (
            <li key={t as string}>
              <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[#b8a6ff]">{icon}</span>
              <p className="mt-4 text-[16px] font-semibold">{t}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{b}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="border-y border-white/[0.07] bg-white/[0.015]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 md:py-24">
          <h2 className="mk-h2">Up and running in minutes.</h2>
          <p className="mk-lede mt-4">Built for student teams, start-ups and anyone who needs to know early whether a deadline is still realistic.</p>
          <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            <span aria-hidden className="absolute left-5 right-5 top-5 hidden h-px bg-gradient-to-r from-[#4dd8ff]/60 via-[#7c5cff] to-[#7c5cff]/0 md:block" />
            {[
              ["Create a project", "Start from a template for software, coursework or a launch, or begin blank. Add a deadline."],
              ["Add the work and invite your team", "Give each task an owner, a due date and the tasks it waits on. A short tour shows you around."],
              ["Let Pulse keep watch", "Check the health score any time. When something slips, you'll see why and what to do."],
            ].map(([t, b], i) => (
              <li key={t} className="relative">
                <span className="relative flex size-10 items-center justify-center rounded-full border border-[#7c5cff]/60 bg-[#0f1130] text-[15px] font-semibold text-[#c9bcff]">{i + 1}</span>
                <p className="mt-5 text-[19px] font-semibold">{t}</p>
                <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-muted">{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Trust ────────────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-[1180px] gap-12 px-5 py-20 md:grid-cols-[0.9fr_1.1fr] md:py-28">
        <div>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#43d39e]/10 text-[#43d39e]">
            <ShieldCheck className="size-6" />
          </span>
          <h2 className="mk-h2 mt-6 max-w-[14ch]">Built to be trusted with your team&apos;s work.</h2>
          <p className="mk-lede mt-5">Security is part of how Nerox is built, not an add-on.</p>
          <Link href="/security" className="mk-btn mk-btn-ghost mt-8">
            Read about security and privacy
          </Link>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2">
          {[
            [<Lock key="i" className="size-5" />, "Private by default", "Every workspace is walled off inside the database itself, so one team can never read another's projects."],
            [<Users key="i" className="size-5" />, "You decide who sees what", "Owners, admins, members and viewers each get exactly the access their role allows."],
            [<KeyRound key="i" className="size-5" />, "Safe invitations", "Invite links work once, expire, and are stored only as a scrambled fingerprint."],
            [<CreditCard key="i" className="size-5" />, "Payments by Stripe", "Card details go straight to Stripe. They never reach Nerox's servers."],
          ].map(([icon, t, b]) => (
            <li key={t as string} className="bg-[#0b0c2a] p-6">
              <span className="text-[#43d39e]">{icon}</span>
              <p className="mt-4 text-[16px] font-semibold">{t}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{b}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Founder ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1180px] px-5 pb-20">
        <figure className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#1a1450] via-[#11123a] to-[#0b0c2a] p-8 md:p-14">
          <svg aria-hidden className="pointer-events-none absolute -right-10 -top-10 opacity-[0.05]" width="360" height="360" viewBox="0 0 24 24" fill="none">
            <path d="M5 19V5l14 14V5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <blockquote className="relative max-w-[30ch] text-[clamp(24px,3.2vw,38px)] font-medium italic leading-[1.25] tracking-[-0.015em]">&ldquo;{SITE.owner.quote}&rdquo;</blockquote>
          <figcaption className="relative mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#7c5cff] text-[16px] font-semibold text-white" aria-hidden>
              DW
            </span>
            <span>
              <span className="block text-[16px] font-semibold">{SITE.owner.name}</span>
              <span className="block text-[14px] text-muted">Founder and owner of Nerox</span>
            </span>
            <span className="flex flex-wrap gap-3 sm:ml-auto">
              <Link href="/about#founder" className="mk-btn mk-btn-ghost mk-btn-sm">
                Read the story
              </Link>
              <a href={SITE.owner.linkedin} target="_blank" rel="noopener noreferrer" className="mk-btn mk-btn-sm bg-[#0a66c2] text-white hover:brightness-110">
                <LinkedinIcon className="size-4" /> Connect on LinkedIn
              </a>
            </span>
          </figcaption>
        </figure>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-[1180px] gap-10 px-5 pb-20 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="mk-h2">Questions, answered.</h2>
          <p className="mt-4 text-[15px] text-muted">
            Anything else?{" "}
            <Link href="/contact" className="font-semibold text-[#b8a6ff] hover:underline">
              Get in touch
            </Link>
            .
          </p>
        </div>
        <Faq paid={paid} />
      </section>

      <section className="mx-auto max-w-[1180px] px-5 pb-20">
        <InstagramBand />
      </section>

      {/* ── Final call to action ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1180px] px-5 pb-24">
        <div className="relative overflow-hidden rounded-[28px] border border-[#7c5cff]/40 px-8 py-16 text-center md:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 80% at 50% 0%, rgb(124 92 255 / 0.35), transparent 70%)" }} />
          <svg aria-hidden className="pointer-events-none absolute inset-x-0 bottom-6 mx-auto h-16 w-full max-w-[700px] opacity-40" viewBox="0 0 700 64" preserveAspectRatio="none" fill="none">
            <path d="M0 40 H260 L276 40 L290 12 L306 58 L320 28 L332 40 H700" stroke="#7c5cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 className="mk-h2 relative mx-auto max-w-[18ch]">Start your first project in five minutes.</h2>
          <p className="relative mx-auto mt-4 max-w-md text-[17px] text-muted">Free plan, no card needed. A short tour shows you around the first time you sign in.</p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="mk-btn mk-btn-primary">
              Create my free account
            </Link>
            <Link href="/pricing" className="mk-btn mk-btn-ghost">
              Compare plans
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Showcase({
  name,
  title,
  body,
  points,
  visual,
  color,
  icon,
  flip,
}: {
  name: string;
  title: string;
  body: string;
  points: string[];
  visual: React.ReactNode;
  color: string;
  icon: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <section className={`mx-auto grid max-w-[1180px] items-center gap-10 px-5 py-14 md:py-20 lg:gap-16 ${flip ? "lg:grid-cols-[1.15fr_0.85fr]" : "lg:grid-cols-[0.85fr_1.15fr]"}`}>
      <div className={flip ? "lg:order-2" : undefined}>
        <p className="flex items-center gap-2.5 text-[15px] font-semibold" style={{ color }}>
          <span className="flex size-9 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
            {icon}
          </span>
          {name}
        </p>
        <h2 className="mk-h2 mt-5">{title}</h2>
        <p className="mt-5 text-[17px] leading-relaxed text-muted">{body}</p>
        <ul className="mt-7 space-y-3 text-[15px]">
          {points.map((p) => (
            <li key={p} className="flex gap-3">
              <span aria-hidden className="mt-[9px] h-px w-4 shrink-0" style={{ background: color }} />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? "lg:order-1" : undefined}>{visual}</div>
    </section>
  );
}
