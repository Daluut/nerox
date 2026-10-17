"use client";

import Link from "next/link";
import { useState } from "react";
import { acknowledgeRisk } from "@/lib/actions/projects";
import type { Risk, RiskAction } from "@/lib/pulse/types";
import { BasisTag, SeverityBadge } from "@/components/ui/badges";
import { canWrite, nameOf, useAppData } from "@/components/shell/app-context";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";

function actionHref(projectId: string, a: RiskAction) {
  switch (a.kind) {
    case "open_task":
    case "assign":
    case "reschedule":
    case "add_estimate":
    case "review_dependencies":
      return `/projects/${projectId}?task=${a.taskId}`;
    case "open_milestones":
      return `/projects/${projectId}#milestones`;
    case "open_list":
      return `/projects/${projectId}/list`;
  }
}

/** A Pulse risk with its evidence, consequence and the actions that address it. */
export function RiskCard({
  risk,
  projectId,
  projectName,
  acknowledged,
  compact,
}: {
  risk: Risk;
  projectId: string;
  projectName?: string;
  acknowledged?: { userId: string; at: string };
  compact?: boolean;
}) {
  const data = useAppData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(!compact && !acknowledged);

  return (
    <article className={cn("rounded-md border bg-panel", acknowledged ? "border-line opacity-80" : "border-line-strong")}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3 text-left">
        <span
          className="mt-1.5 size-2 shrink-0 rounded-full"
          style={{ background: risk.severity === "critical" ? "var(--danger)" : risk.severity === "high" ? "#ec8a3c" : risk.severity === "medium" ? "var(--warning)" : "var(--faint)" }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium leading-snug">{risk.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <SeverityBadge severity={risk.severity} />
            <BasisTag basis={risk.basis} />
            {projectName && <span className="text-[12px] text-faint">{projectName}</span>}
            {acknowledged && <span className="text-[12px] text-faint">Acknowledged by {nameOf(data, acknowledged.userId)}</span>}
          </span>
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-4 py-3 pl-9 text-[13px]">
          <p className="mb-1 text-[12px] text-faint">Evidence</p>
          <ul className="mb-3 list-disc space-y-0.5 pl-4 text-muted marker:text-faint">
            {risk.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          {risk.consequence && (
            <>
              <p className="mb-1 text-[12px] text-faint">Possible consequence</p>
              <p className="mb-3 text-muted">{risk.consequence}</p>
            </>
          )}
          <p className="mb-1 text-[12px] text-faint">Suggested next step</p>
          <p className="text-fg">{risk.recommendation}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {risk.actions.map((a, i) => (
              <Link
                key={i}
                href={actionHref(projectId, a)}
                scroll={false}
                className="rounded-md border border-line-strong px-2.5 py-1 text-[12px] text-fg hover:border-violet hover:bg-violet-soft"
              >
                {a.label}
              </Link>
            ))}
            {canWrite(data.role) && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await acknowledgeRisk(projectId, risk.id, !acknowledged);
                  setBusy(false);
                  if (!r.ok) toast.error(r.error);
                  else toast.success(acknowledged ? "Insight reopened." : "Insight acknowledged.");
                }}
                className="ml-auto text-[12px] text-faint hover:text-fg disabled:opacity-50"
                title="Acknowledging records that the team has seen this. It still counts toward the score until the cause is fixed."
              >
                {acknowledged ? "Reopen" : "Acknowledge"}
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
