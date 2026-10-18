"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, CreditCard, Loader2, XCircle } from "lucide-react";
import { openBillingPortal, startCheckout } from "@/lib/actions/billing";
import { Button, ErrorNote, PageHeader, Panel } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null);

export function BillingView(props: {
  enabled: boolean;
  yearly: boolean;
  canManage: boolean;
  plan: "early_access" | "free" | "pro";
  notice: "payment_failed" | "ending" | null;
  status: string | null;
  interval: "month" | "year" | null;
  seats: number | null;
  periodEnd: string | null;
  hasCustomer: boolean;
  members: number;
  checkout: "success" | "cancelled" | null;
  pricing: { currency: string; proMonthly: number; proYearly: number; freeMemberLimit: number };
  proFeatures: readonly string[];
}) {
  const router = useRouter();
  const [interval, setPeriod] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState<null | "checkout" | "portal">(null);
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(0);
  const { currency, proMonthly, proYearly } = props.pricing;

  // After checkout, Pro switches on only when Stripe's webhook confirms the
  // payment. Re-read the plan for a short while until it does.
  const confirming = props.checkout === "success" && props.plan !== "pro";
  useEffect(() => {
    if (!confirming || waited >= 15) return;
    const t = setTimeout(() => {
      router.refresh();
      setWaited((w) => w + 1);
    }, 3000);
    return () => clearTimeout(t);
  }, [confirming, waited, router]);

  async function go(kind: "checkout" | "portal") {
    setBusy(kind);
    setError(null);
    const r = await (kind === "checkout" ? startCheckout(interval) : openBillingPortal()).catch(() => ({ ok: false as const, error: "Couldn't reach Nerox. Check your connection." }));
    if (!r.ok) {
      setBusy(null);
      setError(r.error);
      return;
    }
    window.location.assign(r.data.url);
  }

  const perSeat = interval === "year" ? proYearly : proMonthly;
  const total = perSeat * props.members;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-8 md:px-10">
      <PageHeader title="Billing" description="Your workspace's plan and payments." icon={<CreditCard className="size-6" />} color="var(--c-about)" />

      {props.checkout === "success" &&
        (props.plan === "pro" ? (
          <Banner tone="success" icon={<CheckCircle2 className="size-5" />} title="You're on Pro.">
            Thanks for upgrading. Every Pro feature is now on for everyone in this workspace.
          </Banner>
        ) : waited < 15 ? (
          <Banner tone="info" icon={<Loader2 className="size-5 animate-spin" />} title="Confirming your payment with Stripe…">
            Pro switches on as soon as Stripe confirms the payment, usually within a few seconds. You can leave this page.
          </Banner>
        ) : (
          <Banner tone="warning" icon={<AlertTriangle className="size-5" />} title="Still waiting for Stripe.">
            Your payment hasn&apos;t been confirmed yet. Refresh this page in a minute. If Pro still isn&apos;t on, email us and we&apos;ll sort it out.
          </Banner>
        ))}
      {props.checkout === "cancelled" && (
        <Banner tone="info" icon={<XCircle className="size-5" />} title="Checkout cancelled.">
          You haven&apos;t been charged. You can upgrade any time.
        </Banner>
      )}
      {props.notice === "payment_failed" && (
        <Banner tone="danger" icon={<AlertTriangle className="size-5" />} title="Your last payment failed.">
          Stripe will try again over the next few days. Update your card with Manage billing to keep Pro.
        </Banner>
      )}
      {props.notice === "ending" && (
        <Banner tone="warning" icon={<AlertTriangle className="size-5" />} title={`Pro ends on ${fmtDate(props.periodEnd) ?? "the end of this period"}.`}>
          After that, this workspace moves to Free. Your projects stay. Changed your mind? Use Manage billing to keep Pro.
        </Banner>
      )}

      <Panel title="Current plan">
        {props.plan === "early_access" ? (
          <div>
            <p className="text-[20px] font-bold">
              Free <span className="ml-1 rounded-full bg-success-soft px-2 py-0.5 text-[12px] font-semibold text-success">Early access</span>
            </p>
            <p className="mt-2 text-[15px] text-muted">Payments aren&apos;t switched on yet, so every feature is included for now. Pro opens soon.</p>
            <Link href="/pricing" className="mt-4 inline-flex h-11 items-center rounded-xl bg-violet px-5 text-[15px] font-semibold text-white hover:bg-violet-strong">
              See plans
            </Link>
          </div>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-3">
            <Stat label="Plan" value={props.plan === "pro" ? "Pro" : "Free"} />
            {props.plan === "pro" ? (
              <>
                <Stat label="Seats" value={`${props.seats ?? props.members}`} hint={props.interval === "year" ? "Billed yearly" : "Billed monthly"} />
                <Stat label={props.notice === "ending" ? "Ends" : "Renews"} value={fmtDate(props.periodEnd) ?? "–"} />
              </>
            ) : (
              <Stat label="People" value={`${props.members} of ${props.pricing.freeMemberLimit}`} hint={`Free workspaces hold up to ${props.pricing.freeMemberLimit} people`} />
            )}
          </dl>
        )}
        {props.enabled && props.hasCustomer && props.canManage && (
          <div className="mt-5 border-t border-line pt-5">
            <Button onClick={() => go("portal")} loading={busy === "portal"}>
              Manage billing
            </Button>
            <p className="mt-2 text-[13px] text-muted">Change your card, download invoices or cancel, on Stripe&apos;s secure page.</p>
          </div>
        )}
      </Panel>

      {props.enabled && props.plan === "free" && (
        <Panel title="Upgrade to Pro">
          <ul className="grid gap-2 sm:grid-cols-2">
            {props.proFeatures.map((f) => (
              <li key={f} className="flex gap-2 text-[14px]">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                {f}
              </li>
            ))}
          </ul>
          {props.canManage ? (
            <>
              {props.yearly && (
                <div role="radiogroup" aria-label="Billing period" className="mt-6 inline-flex rounded-xl border border-line p-1">
                  {(["month", "year"] as const).map((i) => (
                    <button
                      key={i}
                      role="radio"
                      aria-checked={interval === i}
                      onClick={() => setPeriod(i)}
                      className={cn("h-9 rounded-lg px-4 text-[14px] font-semibold transition-colors", interval === i ? "bg-violet text-white" : "text-muted hover:text-fg")}
                    >
                      {i === "month" ? "Monthly" : "Yearly, 2 months free"}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-5 text-[15px]">
                <span className="text-[28px] font-bold tracking-tight">
                  {currency}
                  {total}
                </span>{" "}
                <span className="text-muted">
                  per {interval} for {props.members} {props.members === 1 ? "person" : "people"} ({currency}
                  {perSeat} each)
                </span>
              </p>
              <p className="mt-1 text-[13px] text-muted">Seats follow your team: when people join or leave, Stripe adjusts the next bill.</p>
              {error && (
                <div className="mt-4">
                  <ErrorNote>{error}</ErrorNote>
                </div>
              )}
              <Button variant="primary" size="lg" className="mt-5" onClick={() => go("checkout")} loading={busy === "checkout"}>
                Upgrade to Pro
              </Button>
              <p className="mt-3 text-[13px] text-muted">You&apos;ll pay on Stripe&apos;s secure checkout. Nerox never sees your card details. Cancel any time.</p>
            </>
          ) : (
            <p className="mt-5 text-[14px] text-muted">Only the workspace owner or an admin can upgrade. Ask them to open this page.</p>
          )}
        </Panel>
      )}
      {error && props.plan !== "free" && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-raised px-4 py-3">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[18px] font-bold">{value}</dd>
      {hint && <dd className="text-[12px] text-faint">{hint}</dd>}
    </div>
  );
}

function Banner({ tone, icon, title, children }: { tone: "success" | "info" | "warning" | "danger"; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const tones = {
    success: "bg-success-soft text-success",
    info: "bg-violet-soft text-violet",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <div role="status" className={cn("flex gap-3 rounded-2xl px-5 py-4", tones[tone].split(" ")[0])}>
      <span className={cn("mt-0.5 shrink-0", tones[tone].split(" ")[1])}>{icon}</span>
      <div>
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[14px] text-muted">{children}</p>
      </div>
    </div>
  );
}
