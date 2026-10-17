import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { SITE } from "@/config/site";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Plans and pricing" };

export default function PricingPage() {
  const interest = (plan: string) =>
    `mailto:${SITE.contact.email}?subject=${encodeURIComponent(`Nerox ${plan} plan`)}&body=${encodeURIComponent(`Hi Nerox team,\n\nI'm interested in the ${plan} plan.\n\nTeam size:\nCompany:\n`)}`;
  return (
    <div className="mx-auto max-w-[1180px] px-5 py-16">
      <p className="text-[15px] font-semibold text-violet">Plans and pricing</p>
      <h1 className="mt-2 max-w-3xl text-[42px] font-bold leading-tight tracking-tight">Free to start. Room to grow.</h1>
      <p className="mt-4 max-w-2xl text-[18px] text-muted">
        Sign up and use everything in Nerox for free while we&apos;re in early access. Paid plans add more power for growing teams and large companies.
      </p>

      <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {SITE.plans.map((p) => (
          <div
            key={p.id}
            className={cn(
              "relative flex flex-col rounded-3xl border bg-panel p-6 shadow-card",
              p.highlight ? "border-violet ring-2 ring-violet" : "border-line",
            )}
          >
            {p.highlight && <span className="absolute -top-3 left-6 rounded-full bg-violet px-3 py-1 text-[12px] font-bold text-white">Most popular</span>}
            <p className="text-[20px] font-bold">{p.name}</p>
            <p className="mt-1 text-[14px] text-muted">{p.blurb}</p>
            <p className="mt-5">
              <span className="text-[38px] font-bold tracking-tight">{p.price}</span>
              <span className="ml-1.5 text-[14px] text-muted">{p.per}</span>
            </p>
            {p.id !== "free" && <p className="mt-1 text-[12px] font-semibold text-c-memory">Coming soon</p>}
            <ul className="mt-5 flex-1 space-y-2.5 text-[14px]">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  {f}
                </li>
              ))}
            </ul>
            {p.id === "free" ? (
              <Link href="/signup" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-violet text-[15px] font-semibold text-white hover:bg-violet-strong">
                {p.cta}
              </Link>
            ) : (
              <a
                href={interest(p.name)}
                className={cn(
                  "mt-6 inline-flex h-12 items-center justify-center rounded-xl text-[15px] font-semibold",
                  p.highlight ? "bg-violet text-white hover:bg-violet-strong" : "border border-line-strong hover:bg-hover",
                )}
              >
                {p.cta}
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-panel p-6">
          <p className="text-[17px] font-semibold">Can I use Nerox for free?</p>
          <p className="mt-1 text-[15px] text-muted">Yes. Create an account and every feature on the Free plan is yours, including Pulse, What If? and Memory.</p>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-6">
          <p className="text-[17px] font-semibold">When can I buy a paid plan?</p>
          <p className="mt-1 text-[15px] text-muted">
            Paid plans aren&apos;t on sale yet. Press &ldquo;Register interest&rdquo; and we&apos;ll email you first when they open, or follow{" "}
            <a href={SITE.instagram.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-violet hover:underline">
              @{SITE.instagram.handle}
            </a>{" "}
            for the announcement.
          </p>
        </div>
      </div>
    </div>
  );
}
