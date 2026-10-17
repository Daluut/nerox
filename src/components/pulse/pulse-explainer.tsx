import Link from "next/link";
import { FACTOR_KEYS, FACTOR_LABEL, FACTOR_QUESTION } from "@/lib/pulse/config";
import { HEALTH_COLOR } from "@/components/ui/badges";

/** Plain-English explanation of what Pulse is and how its score works. */
export function PulseExplainer({ open = false }: { open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-line bg-panel shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4">
        <span>
          <span className="block text-[17px] font-semibold">What is Pulse, and how does it work?</span>
          <span className="block text-[14px] text-muted">A one-minute explanation.</span>
        </span>
        <span className="rounded-lg border border-line px-3 py-1 text-[13px] font-semibold text-muted group-open:hidden">Show</span>
        <span className="hidden rounded-lg border border-line px-3 py-1 text-[13px] font-semibold text-muted group-open:inline">Hide</span>
      </summary>
      <div className="border-t border-line px-6 pb-6 pt-5 text-[15px]">
        <p className="max-w-3xl text-muted">
          Pulse is like a check-up for each project. Every time you open Nerox it reads the project&apos;s tasks, due dates, links and owners, and answers seven simple questions. Each answer becomes a mark out of
          100, and together they make the project&apos;s <span className="font-semibold text-fg">health score</span>.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {FACTOR_KEYS.map((k) => (
            <li key={k} className="rounded-xl bg-raised px-4 py-3">
              <span className="block text-[14px] font-semibold">{FACTOR_LABEL[k]}</span>
              <span className="block text-[14px] text-muted">{FACTOR_QUESTION[k]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 font-semibold">What the score means</p>
        <ul className="mt-2 flex flex-wrap gap-2 text-[14px]">
          {(
            [
              ["80 to 100", "Healthy", "healthy"],
              ["60 to 79", "Needs attention", "attention"],
              ["40 to 59", "At risk", "at_risk"],
              ["Below 40", "Critical", "critical"],
            ] as const
          ).map(([range, label, key]) => (
            <li key={key} className="rounded-full px-3 py-1 font-semibold" style={{ color: HEALTH_COLOR[key], background: `color-mix(in srgb, ${HEALTH_COLOR[key]} 13%, transparent)` }}>
              {range}: {label}
            </li>
          ))}
        </ul>
        <p className="mt-5 font-semibold">Risks, not just a number</p>
        <p className="mt-1 max-w-3xl text-muted">
          Under the score, Pulse lists the specific problems it found, like &ldquo;API is 5 days overdue and 3 tasks are waiting on it&rdquo;. Each one shows the evidence, what could happen next and a suggested fix,
          with buttons to act on it. Each is labelled as a <span className="text-fg">fact</span>, a <span className="text-fg">rule-based check</span> or a <span className="text-fg">forecast</span>, so you
          know how sure it is.
        </p>
        <p className="mt-5 font-semibold">Honest about what it can&apos;t see</p>
        <p className="mt-1 max-w-3xl text-muted">
          If a project has no due dates, for example, Pulse doesn&apos;t pretend it&apos;s fine. It leaves that check out and tells you what&apos;s missing. Want some checks to count more than others? Admins can
          change the{" "}
          <Link href="/settings" className="font-semibold text-violet hover:underline">
            weighting in Settings
          </Link>
          .
        </p>
      </div>
    </details>
  );
}
