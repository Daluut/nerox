"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "board", label: "Board" },
  { slug: "list", label: "List" },
  { slug: "timeline", label: "Timeline" },
  { slug: "pulse", label: "Pulse" },
  { slug: "activity", label: "Activity" },
];

export function ProjectTabs({ projectId, riskCount }: { projectId: string; riskCount: number }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  return (
    <nav aria-label="Project views" className="mt-6 flex gap-2 overflow-x-auto pb-1">
      {TABS.map((t) => {
        const href = t.slug ? `${base}/${t.slug}` : base;
        const active = pathname === href;
        return (
          <Link
            key={t.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center whitespace-nowrap rounded-xl px-4 text-[14px] font-semibold",
              active ? "bg-violet text-white" : "border border-line bg-panel text-muted hover:text-fg",
            )}
          >
            {t.label}
            {t.slug === "pulse" && riskCount > 0 && <span className="num ml-2 rounded-full bg-warning px-1.5 text-[11px] text-white">{riskCount}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
