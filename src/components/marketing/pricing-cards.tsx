"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/components/ui/cn";

interface Plan {
  id: string;
  name: string;
  blurb: string;
  features: readonly string[];
}

/** Free and Pro side by side, with a monthly/yearly switch for Pro. */
export function PricingCards({
  plans,
  pricing,
  billing,
  yearly,
  signedIn,
  interestHref,
}: {
  plans: readonly Plan[];
  pricing: { currency: string; proMonthly: number; proYearly: number };
  billing: boolean;
  yearly: boolean;
  signedIn: boolean;
  interestHref: string;
}) {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const showToggle = !billing || yearly; // before launch, show both planned prices
  const proPrice = period === "year" ? pricing.proYearly : pricing.proMonthly;
  const upgradeHref = signedIn ? "/settings/billing" : `/signup?next=${encodeURIComponent("/settings/billing")}`;

  return (
    <div>
      {showToggle && (
        <div role="radiogroup" aria-label="Billing period" className="mx-auto mb-10 flex w-fit rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {(["month", "year"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={period === p}
              onClick={() => setPeriod(p)}
              className={cn("h-10 rounded-xl px-5 text-[14px] font-semibold transition-colors", period === p ? "bg-[#7c5cff] text-white shadow-[0_6px_20px_-6px_rgb(124_92_255/0.8)]" : "text-muted hover:text-fg")}
            >
              {p === "month" ? "Monthly" : "Yearly"}
              {p === "year" && <span className={cn("ml-2 text-[12px]", period === p ? "text-white/80" : "text-[#43d39e]")}>2 months free</span>}
            </button>
          ))}
        </div>
      )}

      <div className="mx-auto grid max-w-[920px] gap-5 md:grid-cols-2">
        {plans.map((p) => {
          const pro = p.id === "pro";
          return (
            <div
              key={p.id}
              className={cn(
                "relative flex flex-col rounded-[26px] p-7 sm:p-8",
                pro ? "bg-gradient-to-b from-[#221a66] to-[#11123a] shadow-[0_40px_80px_-30px_rgb(124_92_255/0.5)] ring-1 ring-[#7c5cff]/60" : "mk-surface",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-[22px] font-semibold">{p.name}</p>
                {pro && !billing && <span className="rounded-full bg-[#ffcf5a]/15 px-3 py-1 text-[12px] font-semibold text-[#ffcf5a]">Coming soon</span>}
              </div>
              <p className="mt-2 text-[15px] text-muted">{p.blurb}</p>
              <p className="mt-7 flex items-baseline gap-2">
                <span className="text-[52px] font-semibold leading-none tracking-[-0.04em]">
                  {pricing.currency}
                  {pro ? proPrice : 0}
                </span>
                <span className="text-[14px] text-muted">{pro ? `per person / ${period}` : "forever"}</span>
              </p>
              {pro && period === "year" && (
                <p className="mt-2 text-[13px] text-[#43d39e]">
                  Instead of {pricing.currency}
                  {pricing.proMonthly * 12} a year
                </p>
              )}
              <ul className="mt-8 flex-1 space-y-3 text-[15px]">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-3">
                    <Check className={cn("mt-0.5 size-[18px] shrink-0", pro ? "text-[#b8a6ff]" : "text-[#43d39e]")} />
                    {f}
                  </li>
                ))}
              </ul>
              {pro ? (
                billing ? (
                  <Link href={upgradeHref} className="mk-btn mk-btn-primary mt-9 w-full">
                    {signedIn ? "Upgrade to Pro" : "Start free, then upgrade"}
                  </Link>
                ) : (
                  <a href={interestHref} className="mk-btn mk-btn-primary mt-9 w-full">
                    Register interest
                  </a>
                )
              ) : (
                <Link href={signedIn ? "/overview" : "/signup"} className="mk-btn mk-btn-ghost mt-9 w-full">
                  {signedIn ? "Open Nerox" : "Start free"}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
