import type { Metadata } from "next";
import Link from "next/link";
import { Check, Lock, Minus } from "lucide-react";
import { SITE } from "@/config/site";
import { billingEnabled, yearlyAvailable } from "@/lib/billing/config";
import { createClient } from "@/lib/supabase/server";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Faq } from "@/components/marketing/faq";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Nerox is free for teams of up to 5. Pro adds unlimited people, full Nerox AI answers and spreadsheet export.",
  alternates: { canonical: "/pricing" },
};

const COMPARE: [string, boolean | string, boolean | string][] = [
  ["Projects and tasks", "Unlimited", "Unlimited"],
  ["Board, list and timeline", true, true],
  ["Pulse health checks", true, true],
  ["What If? simulations", true, true],
  ["Memory lessons and retrospectives", true, true],
  ["People in a workspace", `Up to ${SITE.pricing.freeMemberLimit}`, "Unlimited"],
  ["Nerox AI help guide", true, true],
  ["Nerox AI full answers about your projects", false, true],
  ["Export tasks as a spreadsheet (CSV)", false, true],
  ["Priority email support", false, true],
];

export default async function PricingPage() {
  let signedIn = false;
  try {
    signedIn = !!(await (await createClient()).auth.getUser()).data.user;
  } catch {}
  const billing = billingEnabled();
  const interest = `mailto:${SITE.contact.email}?subject=${encodeURIComponent("Nerox Pro")}&body=${encodeURIComponent("Hi Nerox team,\n\nI'd like to hear when Pro opens.\n\nTeam size:\nWhat we'd use Nerox for:\n")}`;
  const teams = `mailto:${SITE.contact.email}?subject=${encodeURIComponent("Nerox for our organisation")}`;

  return (
    <div className="relative">
      <div aria-hidden className="mk-light pointer-events-none absolute inset-x-0 top-[-68px] h-[600px]" />
      <div className="relative mx-auto max-w-[1180px] px-5 pb-10 pt-16 md:pt-24">
        <div className="mx-auto max-w-[760px] text-center">
          <h1 className="mk-display mk-enter text-[clamp(40px,6vw,68px)]" style={{ ["--i" as string]: 0 }}>
            Simple pricing that grows with your team.
          </h1>
          <p className="mk-lede mk-enter mx-auto mt-6" style={{ ["--i" as string]: 1 }}>
            Start free with everything Nerox does. Move to Pro when your team grows or you want Nerox AI working on your own projects.
          </p>
          {!billing && (
            <p className="mk-enter mx-auto mt-6 w-fit rounded-full border border-[#43d39e]/30 bg-[#43d39e]/10 px-4 py-1.5 text-[14px] text-[#7ee8be]" style={{ ["--i" as string]: 2 }}>
              Early access: every feature is free for now. Pro opens soon.
            </p>
          )}
        </div>

        <div className="mk-enter mt-14" style={{ ["--i" as string]: 3 }}>
          <PricingCards plans={SITE.plans} pricing={SITE.pricing} billing={billing} yearly={yearlyAvailable()} signedIn={signedIn} interestHref={interest} />
        </div>

        <div className="mx-auto mt-6 flex max-w-[920px] flex-col gap-4 rounded-[22px] border border-white/10 bg-white/[0.02] p-6 sm:flex-row sm:items-center sm:p-7">
          <div className="flex-1">
            <p className="text-[17px] font-semibold">{SITE.teams.title}</p>
            <p className="mt-1 text-[15px] text-muted">{SITE.teams.body}</p>
          </div>
          <a href={teams} className="mk-btn mk-btn-ghost mk-btn-sm">
            Email us
          </a>
        </div>
        <p className="mx-auto mt-6 flex max-w-[920px] items-center justify-center gap-2 text-[13px] text-faint">
          <Lock className="size-3.5" /> Payments are handled by Stripe. Prices are per person in your workspace{billing ? ", and you can cancel any time" : ""}.
        </p>

        {/* Compare */}
        <section className="mx-auto mt-24 max-w-[920px]">
          <h2 className="mk-h2">Compare plans</h2>
          <div className="mt-8 overflow-x-auto rounded-[22px] border border-white/10">
            <table className="w-full min-w-[520px] border-collapse text-left text-[15px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th scope="col" className="px-5 py-4 font-medium text-muted">
                    Feature
                  </th>
                  <th scope="col" className="w-[150px] px-5 py-4 font-semibold">
                    Free
                  </th>
                  <th scope="col" className="w-[150px] px-5 py-4 font-semibold text-[#c9bcff]">
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(([f, free, pro]) => (
                  <tr key={f} className="border-b border-white/[0.06] last:border-0">
                    <th scope="row" className="px-5 py-3.5 font-normal">
                      {f}
                    </th>
                    <Cell v={free} />
                    <Cell v={pro} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mx-auto mt-24 grid max-w-[920px] gap-10 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="mk-h2">Pricing questions</h2>
            <p className="mt-4 text-[15px] text-muted">
              Still unsure?{" "}
              <Link href="/contact" className="font-semibold text-[#b8a6ff] hover:underline">
                Ask us
              </Link>
              .
            </p>
          </div>
          <Faq paid={billing} />
        </section>
      </div>
    </div>
  );
}

function Cell({ v }: { v: boolean | string }) {
  return (
    <td className="px-5 py-3.5">
      {v === true ? (
        <Check className="size-[18px] text-[#43d39e]" aria-label="Included" />
      ) : v === false ? (
        <Minus className="size-[18px] text-faint" aria-label="Not included" />
      ) : (
        <span className="text-[14px]">{v}</span>
      )}
    </td>
  );
}
