import type { Metadata } from "next";
import { CreditCard, History, KeyRound, Lock, ShieldCheck, Sparkles, Users } from "lucide-react";
import { SITE } from "@/config/site";

export const metadata: Metadata = {
  title: "Security and privacy",
  description: "How Nerox keeps each team's work private: database-level isolation, roles, safe invitations and payments through Stripe.",
  alternates: { canonical: "/security" },
};

const ITEMS = [
  {
    icon: <Lock className="size-5" />,
    title: "Each workspace is walled off",
    body: "Access rules live inside the database itself (row-level security), not just in the app. Every read and write is checked against your membership, so one team can't see another team's projects, even by guessing a link.",
  },
  {
    icon: <Users className="size-5" />,
    title: "Roles decide what people can do",
    body: "Owners, admins, members and viewers each get only the access their role allows. Viewers can read but never change anything. Removing someone takes away their access straight away.",
  },
  {
    icon: <KeyRound className="size-5" />,
    title: "Invitations that can't be reused",
    body: "Invite links work once and expire. Nerox stores only a one-way fingerprint (a SHA-256 hash) of each link, so even someone reading the database couldn't use them. You can lock an invite to one email address, or cancel it.",
  },
  {
    icon: <ShieldCheck className="size-5" />,
    title: "Sign-in handled by Supabase Auth",
    body: "Accounts and passwords are managed by Supabase Auth. Passwords are stored only as secure hashes, and resets go through a link sent to your email.",
  },
  {
    icon: <History className="size-5" />,
    title: "History you can trust",
    body: "Task history, completion times and the activity log are recorded by the database, not by the browser, so they can't be faked from someone's computer.",
  },
  {
    icon: <CreditCard className="size-5" />,
    title: "Payments through Stripe",
    body: "When you upgrade, you pay on Stripe's secure checkout. Card details go straight to Stripe and never reach Nerox. Pro is switched on only when Stripe sends a signed confirmation, which Nerox verifies.",
  },
  {
    icon: <Sparkles className="size-5" />,
    title: "Clear about Nerox AI",
    body: "The help guide answers without sending your question anywhere. When full AI answers are on, your question, the page you're on and a short summary of your active projects (names, health, progress, deadlines and top risks) are sent to Anthropic to write the reply. Nothing else from your workspace is sent.",
  },
];

export default function SecurityPage() {
  return (
    <div className="relative">
      <div aria-hidden className="mk-light pointer-events-none absolute inset-x-0 top-[-68px] h-[520px]" />
      <div className="relative mx-auto max-w-[1180px] px-5 pb-24 pt-16 md:pt-24">
        <span className="mk-enter flex size-14 items-center justify-center rounded-2xl bg-[#43d39e]/10 text-[#43d39e]" style={{ ["--i" as string]: 0 }}>
          <ShieldCheck className="size-7" />
        </span>
        <h1 className="mk-display mk-enter mt-7 max-w-[15ch] text-[clamp(40px,6vw,72px)]" style={{ ["--i" as string]: 1 }}>
          Your team&apos;s work stays your team&apos;s.
        </h1>
        <p className="mk-lede mk-enter mt-6" style={{ ["--i" as string]: 2 }}>
          Here&apos;s how Nerox protects your projects, in plain English. If you have a question or think you&apos;ve found a security problem, email{" "}
          <a href={`mailto:${SITE.contact.email}`} className="font-semibold text-[#b8a6ff] hover:underline">
            {SITE.contact.email}
          </a>
          .
        </p>

        <ul className="mt-16 grid gap-px overflow-hidden rounded-[26px] border border-white/10 bg-white/10 md:grid-cols-2">
          {ITEMS.map((it, i) => (
            <li key={it.title} className={`bg-[#0b0c2a] p-7 md:p-8 ${i === ITEMS.length - 1 && ITEMS.length % 2 ? "md:col-span-2" : ""}`}>
              <span className="text-[#43d39e]">{it.icon}</span>
              <h2 className="mt-4 text-[18px] font-semibold">{it.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{it.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
