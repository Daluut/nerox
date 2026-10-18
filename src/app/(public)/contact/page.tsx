import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { SITE } from "@/config/site";
import { LinkedinIcon } from "@/components/ui/linkedin-icon";
import { INSTAGRAM_GRADIENT, InstagramIcon } from "@/components/ui/instagram-icon";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions, feedback, partnership ideas or a bug to report: get in touch with the Nerox team.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const { email, responseTime } = SITE.contact;
  const { linkedin, name } = SITE.owner;
  const channels = [
    { icon: <Mail className="size-5" />, bg: "rgb(77 216 255 / 0.12)", fg: "#4dd8ff", title: "Email", body: email, href: `mailto:${email}`, cta: "Write to us" },
    { icon: <LinkedinIcon className="size-5" />, bg: "#0a66c2", fg: "#fff", title: "LinkedIn", body: `Connect with ${name}, the founder.`, href: linkedin, cta: "Connect" },
    { icon: <InstagramIcon className="size-5" />, bg: INSTAGRAM_GRADIENT, fg: "#fff", title: "Instagram", body: `Updates and new features at @${SITE.instagram.handle}.`, href: SITE.instagram.url, cta: "Follow" },
  ];
  return (
    <div className="relative">
      <div aria-hidden className="mk-light pointer-events-none absolute inset-x-0 top-[-68px] h-[520px]" />
      <div className="relative mx-auto max-w-[1180px] px-5 pb-24 pt-16 md:pt-24">
        <h1 className="mk-display mk-enter max-w-[14ch] text-[clamp(40px,6vw,72px)]" style={{ ["--i" as string]: 0 }}>
          Let&apos;s talk.
        </h1>
        <p className="mk-lede mk-enter mt-6" style={{ ["--i" as string]: 1 }}>
          Questions, feedback, partnership ideas or a bug to report. {responseTime}
        </p>

        <div className="mt-14 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <ul className="divide-y divide-white/10 self-start rounded-[24px] border border-white/10">
            {channels.map((c) => (
              <li key={c.title}>
                <a
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="group flex items-center gap-4 p-6 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: c.bg, color: c.fg }}>
                    {c.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-semibold">{c.title}</span>
                    <span className="block break-all text-[15px] text-muted">{c.body}</span>
                  </span>
                  <span className="text-[14px] font-semibold text-[#b8a6ff] transition-transform group-hover:translate-x-0.5">{c.cta}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mk-surface rounded-[24px] p-6 md:p-8">
            <h2 className="text-[22px] font-semibold">Send us a message</h2>
            <ContactForm email={email} />
          </div>
        </div>
      </div>
    </div>
  );
}
