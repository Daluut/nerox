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
    <nav aria-label="Project views" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((t) => {
        const href = t.slug ? `${base}/${t.slug}` : base;
        const active = pathname === href;
        return (
          <Link
            key={t.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px]", active ? "border-violet text-fg" : "border-transparent text-muted hover:text-fg")}
          >
            {t.label}
            {t.slug === "pulse" && riskCount > 0 && <span className="num ml-1.5 text-[11px] text-warning">{riskCount}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
