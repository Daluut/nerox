import type { Metadata } from "next";
import { LinkedinIcon } from "@/components/ui/linkedin-icon";
import { Mail } from "lucide-react";
import { SITE } from "@/config/site";
import { IconBadge } from "@/components/ui/primitives";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  const { email, responseTime } = SITE.contact;
  const { linkedin, name } = SITE.owner;
  return (
    <div className="mx-auto max-w-[980px] px-5 py-16">
      <p className="text-[15px] font-semibold text-violet">Contact</p>
      <h1 className="mt-2 text-[42px] font-bold leading-tight tracking-tight">Get in touch</h1>
      <p className="mt-4 max-w-2xl text-[18px] text-muted">Questions, feedback, partnership ideas or a bug to report. {responseTime}</p>

      <div className="mt-10 grid gap-6 md:grid-cols-[1fr_1.3fr]">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-panel p-6 shadow-card">
            <IconBadge color="var(--c-tasks)" size={44}>
              <Mail className="size-5" />
            </IconBadge>
            <p className="mt-4 text-[18px] font-semibold">Email</p>
            {email ? (
              <a href={`mailto:${email}`} className="mt-1 block break-all text-[16px] font-medium text-violet hover:underline">
                {email}
              </a>
            ) : (
              <p className="mt-1 text-[15px] text-muted">Email address coming soon.</p>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-panel p-6 shadow-card">
            <IconBadge color="#0a66c2" size={44}>
              <LinkedinIcon className="size-5" />
            </IconBadge>
            <p className="mt-4 text-[18px] font-semibold">LinkedIn</p>
            <p className="mt-1 text-[15px] text-muted">Connect with {name || "the founder"} and follow how Nerox grows.</p>
            {linkedin ? (
              <a
                href={linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0a66c2] px-5 text-[15px] font-semibold text-white hover:brightness-110"
              >
                <LinkedinIcon className="size-4" /> Connect on LinkedIn
              </a>
            ) : (
              <p className="mt-3 text-[14px] text-faint">LinkedIn profile coming soon.</p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-6 shadow-card md:p-8">
          <h2 className="text-[22px] font-bold">Send us a message</h2>
          {email ? (
            <ContactForm email={email} />
          ) : (
            <p className="mt-3 text-[15px] text-muted">The contact form switches on once an email address is set. (Site owner: add it in <code className="text-fg">src/config/site.ts</code>.)</p>
          )}
        </div>
      </div>
    </div>
  );
}
