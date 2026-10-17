import type { Metadata } from "next";
import { LinkedinIcon } from "@/components/ui/linkedin-icon";
import Link from "next/link";
import { Heart, Sparkles, Target, Users } from "lucide-react";
import { SITE } from "@/config/site";
import { Avatar, ButtonLink, IconBadge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "About us" };

const VALUE_STYLE = [
  { icon: <Sparkles className="size-5" />, color: "var(--c-home)" },
  { icon: <Heart className="size-5" />, color: "var(--c-pulse)" },
  { icon: <Users className="size-5" />, color: "var(--c-team)" },
];

export default function AboutPage() {
  const owner = SITE.owner;
  return (
    <div className="mx-auto max-w-[980px] px-5 py-16">
      <p className="text-[15px] font-semibold text-violet">About {SITE.name}</p>
      <h1 className="mt-2 text-[42px] font-bold leading-tight tracking-tight">Who we are</h1>
      <p className="mt-4 max-w-2xl text-[19px] leading-relaxed text-muted">{SITE.description}</p>

      <section className="mt-12 grid gap-8 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4 text-[17px] leading-relaxed">
          <h2 className="text-[24px] font-bold">Our story</h2>
          {SITE.story.map((p, i) => (
            <p key={i} className="text-muted">
              {p}
            </p>
          ))}
        </div>
        <div className="self-start rounded-2xl border border-line bg-panel p-6 shadow-card">
          <IconBadge color="var(--violet)" size={44}>
            <Target className="size-5" />
          </IconBadge>
          <h2 className="mt-4 text-[18px] font-bold">Our mission</h2>
          <p className="mt-2 text-[16px] leading-relaxed text-muted">{SITE.mission}</p>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-[24px] font-bold">What we believe</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {SITE.values.map((v, i) => (
            <div key={v.title} className="rounded-2xl border border-line bg-panel p-6 shadow-card">
              <IconBadge color={VALUE_STYLE[i % 3].color} size={44}>
                {VALUE_STYLE[i % 3].icon}
              </IconBadge>
              <p className="mt-4 text-[18px] font-semibold">{v.title}</p>
              <p className="mt-1 text-[15px] text-muted">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16" id="founder">
        <h2 className="text-[24px] font-bold">Meet the founder</h2>
        {owner.name ? (
          <div className="mt-6 flex flex-col gap-6 rounded-2xl border border-line bg-panel p-6 shadow-card sm:flex-row sm:items-center">
            <Avatar name={owner.name} size={84} />
            <div className="flex-1">
              <p className="text-[22px] font-bold">{owner.name}</p>
              <p className="text-[15px] font-medium text-violet">
                {owner.role}, {SITE.name}
              </p>
              {owner.bio && <p className="mt-2 max-w-xl text-[16px] text-muted">{owner.bio}</p>}
            </div>
            {owner.linkedin && (
              <a
                href={owner.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#0a66c2] px-5 text-[15px] font-semibold text-white hover:brightness-110"
              >
                <LinkedinIcon className="size-5" /> Connect on LinkedIn
              </a>
            )}
          </div>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-line-strong p-6 text-[15px] text-muted">
            The founder&apos;s profile will appear here. (Site owner: add your name, bio and LinkedIn link in <code className="text-fg">src/config/site.ts</code>.)
          </p>
        )}
      </section>

      <section className="mt-16 flex flex-col items-start gap-4 rounded-3xl bg-violet-soft p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[20px] font-bold">Want to say hello?</p>
          <p className="text-[16px] text-muted">Questions, feedback or ideas are all welcome.</p>
        </div>
        <div className="flex gap-3">
          <ButtonLink href="/contact" variant="primary">
            Contact us
          </ButtonLink>
          <Link href="/signup" className="inline-flex h-11 items-center rounded-xl px-4 text-[15px] font-semibold text-violet hover:underline">
            Try Nerox
          </Link>
        </div>
      </section>
    </div>
  );
}
