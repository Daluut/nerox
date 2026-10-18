import type { Metadata } from "next";
import Link from "next/link";
import { Activity, BookOpen, Eye, GraduationCap, Sparkles, Split } from "lucide-react";
import { SITE } from "@/config/site";
import { LinkedinIcon } from "@/components/ui/linkedin-icon";
import { InstagramBand } from "@/components/marketing/instagram-band";

export const metadata: Metadata = {
  title: "About us",
  description: `Who we are, why Nerox is different, and the founder behind it, ${SITE.owner.name}.`,
  alternates: { canonical: "/about" },
};

const DIFF_STYLE = [
  { icon: <Activity className="size-5" />, color: "#ff7ac6" },
  { icon: <Split className="size-5" />, color: "#b69bff" },
  { icon: <BookOpen className="size-5" />, color: "#ffcf5a" },
  { icon: <Sparkles className="size-5" />, color: "#8f6bff" },
  { icon: <Eye className="size-5" />, color: "#4dd8ff" },
  { icon: <GraduationCap className="size-5" />, color: "#43d39e" },
];

export default function AboutPage() {
  const owner = SITE.owner;
  return (
    <div className="relative">
      <div aria-hidden className="mk-light pointer-events-none absolute inset-x-0 top-[-68px] h-[560px]" />

      {/* Intro */}
      <section className="relative mx-auto max-w-[1180px] px-5 pb-16 pt-16 md:pt-24">
        <p className="mk-enter text-[15px] font-medium text-[#b8a6ff]" style={{ ["--i" as string]: 0 }}>
          About Nerox
        </p>
        <h1 className="mk-display mk-enter mt-4 max-w-[16ch] text-[clamp(40px,6.4vw,76px)]" style={{ ["--i" as string]: 1 }}>
          Built so good teams stop missing deadlines.
        </h1>
        <p className="mk-lede mk-enter mt-7" style={{ ["--i" as string]: 2 }}>
          {SITE.description}
        </p>
      </section>

      {/* Story */}
      <section className="mx-auto grid max-w-[1180px] gap-10 px-5 py-14 md:grid-cols-[0.7fr_1.3fr]">
        <h2 className="mk-h2 md:sticky md:top-28 md:self-start">Our story</h2>
        <div className="space-y-6 text-[17px] leading-relaxed text-muted">
          <p className="text-[clamp(20px,2.2vw,26px)] font-medium leading-snug text-fg">{SITE.story[0]}</p>
          {SITE.story.slice(1).map((p) => (
            <p key={p.slice(0, 20)}>{p}</p>
          ))}
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-7">
            <p className="text-[14px] font-medium text-[#b8a6ff]">Our mission</p>
            <p className="mt-3 text-[22px] font-medium leading-snug text-fg">{SITE.mission}</p>
          </div>
        </div>
      </section>

      {/* Different */}
      <section className="mx-auto max-w-[1180px] px-5 py-20">
        <h2 className="mk-h2 max-w-[20ch]">Why Nerox is different</h2>
        <p className="mk-lede mt-4">Plenty of tools can hold a to-do list. Nerox is built to help you finish.</p>
        <ul className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
          {SITE.differentiators.map((d, i) => {
            const s = DIFF_STYLE[i % DIFF_STYLE.length];
            return (
              <li key={d.title} className="flex gap-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 13%, transparent)` }}>
                  {s.icon}
                </span>
                <div>
                  <p className="text-[18px] font-semibold">{d.title}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{d.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Values */}
      <section className="border-y border-white/[0.07] bg-white/[0.015]">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-16 md:grid-cols-[0.7fr_repeat(3,1fr)]">
          <h2 className="text-[24px] font-semibold tracking-tight">What we believe</h2>
          {SITE.values.map((v) => (
            <div key={v.title} className="border-t border-[#7c5cff]/50 pt-5">
              <p className="text-[17px] font-semibold">{v.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Founder */}
      <section id="founder" className="mx-auto max-w-[1180px] scroll-mt-24 px-5 py-20 md:py-28">
        <h2 className="mk-h2">Meet the founder</h2>
        <div className="mt-10 grid gap-10 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#1a1450] via-[#11123a] to-[#0b0c2a] p-7 md:grid-cols-[auto_1fr] md:p-12">
          <div className="flex flex-col items-start gap-5">
            <span className="relative flex size-28 items-center justify-center rounded-[28px] bg-gradient-to-br from-[#8b6dff] to-[#4dd8ff] text-[38px] font-semibold text-white shadow-[0_20px_50px_-15px_rgb(124_92_255/0.8)]" aria-hidden>
              DW
            </span>
            <a href={owner.linkedin} target="_blank" rel="noopener noreferrer" className="mk-btn mk-btn-sm bg-[#0a66c2] text-white hover:brightness-110">
              <LinkedinIcon className="size-4" /> Connect on LinkedIn
            </a>
          </div>
          <div>
            <p className="text-[28px] font-semibold tracking-tight">{owner.name}</p>
            <p className="mt-1 text-[15px] font-medium text-[#b8a6ff]">
              {owner.role}, {SITE.name}
            </p>
            <p className="mt-5 max-w-[60ch] text-[17px] leading-relaxed text-muted">{owner.bio}</p>
            <figure className="mt-8 border-l-2 border-[#7c5cff] pl-6">
              <blockquote className="max-w-[34ch] text-[clamp(21px,2.4vw,28px)] font-medium italic leading-snug">&ldquo;{owner.quote}&rdquo;</blockquote>
              <figcaption className="mt-3 text-[14px] text-muted">{owner.name}</figcaption>
            </figure>
          </div>
        </div>

        <div className="mt-12 grid gap-10 md:grid-cols-[0.7fr_1.3fr]">
          <p className="text-[15px] font-medium text-[#b8a6ff] md:pt-2">The vision behind Nerox</p>
          <div className="space-y-5 text-[17px] leading-relaxed text-muted">
            <p className="text-[clamp(20px,2.2vw,26px)] font-medium leading-snug text-fg">{owner.vision[0]}</p>
            {owner.vision.slice(1).map((p) => (
              <p key={p.slice(0, 20)}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-5 pb-8">
        <InstagramBand />
      </section>

      <section className="mx-auto max-w-[1180px] px-5 pb-24">
        <div className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/[0.02] p-7 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-[20px] font-semibold">Want to say hello?</p>
            <p className="mt-1 text-[15px] text-muted">Questions, feedback and ideas are all welcome. A real person reads every message.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/contact" className="mk-btn mk-btn-primary mk-btn-sm">
              Contact us
            </Link>
            <Link href="/signup" className="mk-btn mk-btn-ghost mk-btn-sm">
              Try Nerox free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
