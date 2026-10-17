"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, CheckSquare, FolderKanban, Flag, Plus, Search, User } from "lucide-react";
import { search, type SearchResult } from "@/lib/actions/misc";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/components/ui/cn";
import { canWrite, useAppData } from "./app-context";

interface Item {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  run: () => void;
}

const KIND_ICON: Record<SearchResult["kind"], React.ReactNode> = {
  project: <FolderKanban className="size-4" />,
  task: <CheckSquare className="size-4" />,
  milestone: <Flag className="size-4" />,
  member: <User className="size-4" />,
};

/** Search and quick actions. Results come from the server, scoped by permissions. */
export function CommandPalette({ open, onClose, onCreateTask }: { open: boolean; onClose: () => void; onCreateTask: () => void }) {
  const router = useRouter();
  const data = useAppData();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await search(term).catch(() => null);
      if (id !== seq.current) return; // a newer query is in flight
      setLoading(false);
      setFailed(!r || !r.ok);
      setResults(r && r.ok ? r.data : []);
      setActive(0);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const actions: Item[] = [
    ...(canWrite(data.role)
      ? [
          { id: "a-task", title: "Create task", icon: <Plus className="size-4" />, run: () => (onClose(), onCreateTask()) },
          { id: "a-project", title: "Create project", icon: <Plus className="size-4" />, run: () => go("/projects/new") },
        ]
      : []),
    { id: "a-my", title: "Open My Tasks", icon: <CheckSquare className="size-4" />, run: () => go("/my-tasks") },
    { id: "a-projects", title: "Browse projects", icon: <FolderKanban className="size-4" />, run: () => go("/projects") },
    { id: "a-pulse", title: "Open Pulse", icon: <Activity className="size-4" />, run: () => go("/pulse") },
  ].filter((a) => !q || a.title.toLowerCase().includes(q.toLowerCase()));

  const items: Item[] = [
    ...results.map((r) => ({ id: `${r.kind}:${r.id}`, title: r.title, subtitle: r.subtitle, icon: KIND_ICON[r.kind], run: () => go(r.href) })),
    ...actions,
  ];

  return (
    <Dialog open={open} onClose={onClose} width={560}>
      <div
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, items.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter") items[active]?.run();
          else return;
          e.preventDefault();
        }}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="size-4 text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder="Search projects, tasks, milestones and people"
            aria-label="Search"
            role="combobox"
            aria-expanded
            aria-controls="palette-results"
            aria-activedescendant={items[active] ? `pi-${items[active].id}` : undefined}
            className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
          />
        </div>
        <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {loading && <li className="px-3 py-2 text-[13px] text-faint">Searching…</li>}
          {!loading && failed && <li className="px-3 py-2 text-[13px] text-danger">Search is unavailable right now.</li>}
          {!loading && !failed && q.trim().length >= 2 && !results.length && <li className="px-3 py-2 text-[13px] text-faint">No matches for “{q.trim()}”.</li>}
          {items.map((it, i) => (
            <li
              key={it.id}
              id={`pi-${it.id}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={it.run}
              className={cn("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[13px]", i === active ? "bg-hover text-fg" : "text-muted")}
            >
              <span className="text-faint">{it.icon}</span>
              <span className="flex-1 truncate">{it.title}</span>
              {it.subtitle && <span className="truncate text-[12px] text-faint">{it.subtitle}</span>}
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
