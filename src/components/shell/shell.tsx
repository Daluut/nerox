"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  Bell,
  CheckSquare,
  ChevronsUpDown,
  CircleHelp,
  FolderKanban,
  Home,
  Info,
  LogOut,
  Mail,
  Menu as MenuIcon,
  Plus,
  Search,
  Settings,
  Split,
  Users,
  X,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { createWorkspace, switchWorkspace } from "@/lib/actions/workspace";
import { browserClient } from "@/lib/supabase/client";
import { canWrite, useAppData } from "./app-context";
import { Logo } from "./logo";
import { CommandPalette } from "./command-palette";
import { NotificationBell } from "./notifications";
import { Tour } from "./tour";
import { QuickCreateTask } from "@/components/tasks/quick-create";
import { Avatar, Button, ErrorNote, Field } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { Menu } from "@/components/ui/menu";
import { ThemePicker } from "@/components/ui/theme-picker";
import { cn } from "@/components/ui/cn";

type NavItem = { href: string; label: string; icon: typeof Home; color: string; soon?: boolean; tour?: string };

/** Navigation grouped into small sections so nothing is crammed into one place. */
const SECTIONS: { heading?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/overview", label: "Home", icon: Home, color: "var(--c-home)", tour: "nav-home" },
      { href: "/my-tasks", label: "My Tasks", icon: CheckSquare, color: "var(--c-tasks)", tour: "nav-tasks" },
      { href: "/projects", label: "Projects", icon: FolderKanban, color: "var(--c-projects)", tour: "nav-projects" },
    ],
  },
  {
    heading: "Insights",
    items: [
      { href: "/pulse", label: "Pulse", icon: Activity, color: "var(--c-pulse)", tour: "nav-pulse" },
      { href: "/what-if", label: "What If?", icon: Split, color: "var(--c-whatif)", soon: true },
      { href: "/memory", label: "Memory", icon: BookOpen, color: "var(--c-memory)", soon: true },
    ],
  },
  {
    heading: "People",
    items: [
      { href: "/team", label: "Team", icon: Users, color: "var(--c-team)", tour: "nav-team" },
      { href: "/updates", label: "Updates", icon: Bell, color: "var(--c-tasks)" },
    ],
  },
  {
    heading: "Nerox",
    items: [
      { href: "/about", label: "About us", icon: Info, color: "var(--c-about)" },
      { href: "/contact", label: "Contact", icon: Mail, color: "var(--c-about)" },
    ],
  },
];

const TITLES: Record<string, string> = {
  overview: "Home",
  "my-tasks": "My Tasks",
  projects: "Projects",
  pulse: "Pulse",
  "what-if": "What If?",
  memory: "Memory",
  team: "Team",
  updates: "Updates",
  settings: "Settings",
};

export function Shell({ children }: { children: React.ReactNode }) {
  const data = useAppData();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickCreate, setQuickCreate] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  // Show the tutorial the first time someone uses the app.
  useEffect(() => {
    let seen = data.tourDone;
    try {
      seen = seen || localStorage.getItem("nerox:tour") === "done";
    } catch {}
    if (!seen) {
      const t = setTimeout(() => setTourOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [data.tourDone]);

  // Ctrl/⌘+K opens search, but never steals keystrokes from text fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useRealtimeRefresh(data.workspace.id, data.userId, data.realtime, () => router.refresh());

  const segment = pathname.split("/")[1] ?? "";
  const projectId = segment === "projects" ? pathname.split("/")[2] : undefined;
  const project = projectId ? data.projects.find((p) => p.id === projectId) : undefined;

  const sidebar = (isMobile: boolean) => (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Link href="/overview" aria-label="Nerox home">
          <Logo />
        </Link>
        {isMobile && (
          <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-muted hover:bg-hover hover:text-fg">
            <X className="size-5" />
          </button>
        )}
      </div>

      <div className="px-3" data-tour="workspace">
        <Menu
          label="Switch workspace"
          align="start"
          trigger={
            <span className="flex w-[226px] items-center gap-2.5 rounded-xl border border-line bg-panel px-3 py-2.5 text-left">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet text-[13px] font-bold text-white">
                {data.workspace.name[0]?.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-fg">{data.workspace.name}</span>
                <span className="block text-[12px] text-faint">Workspace</span>
              </span>
              <ChevronsUpDown className="size-4 text-faint" />
            </span>
          }
          items={[
            ...data.workspaces.map((w) => ({
              label: w.id === data.workspace.id ? `${w.name} (current)` : w.name,
              disabled: w.id === data.workspace.id,
              onSelect: () => switchWorkspace(w.id),
            })),
            { label: "New workspace", icon: <Plus className="size-3.5" />, onSelect: () => setNewWorkspace(true) },
          ]}
        />
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
        {SECTIONS.map((section, i) => (
          <div key={i} className={i ? "mt-5" : ""}>
            {section.heading && <p className="mb-1.5 px-3 text-[12px] font-semibold text-faint">{section.heading}</p>}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      data-tour={item.tour}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors",
                        active ? "bg-violet-soft font-semibold text-fg" : "text-muted hover:bg-hover hover:text-fg",
                      )}
                    >
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: active ? item.color : `color-mix(in srgb, ${item.color} 14%, transparent)`, color: active ? "#fff" : item.color }}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {item.soon && <span className="rounded-full bg-hover px-2 py-0.5 text-[11px] font-medium text-faint">Soon</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line p-3">
        <ThemePicker compact />
        <div className="mt-3 flex items-center gap-2">
          <Menu
            label="Account menu"
            align="start"
            trigger={
              <span className="flex w-[184px] items-center gap-2.5 rounded-xl px-2 py-1.5">
                <Avatar name={data.displayName} size={34} />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[14px] font-semibold text-fg">{data.displayName}</span>
                  <span className="block truncate text-[12px] capitalize text-faint">{data.role}</span>
                </span>
              </span>
            }
            items={[
              { label: "Settings", icon: <Settings className="size-3.5" />, onSelect: () => router.push("/settings") },
              { label: "Show the tutorial", icon: <CircleHelp className="size-3.5" />, onSelect: () => setTourOpen(true) },
              { label: "Sign out", icon: <LogOut className="size-3.5" />, onSelect: () => signOut() },
            ]}
          />
          <Link href="/settings" aria-label="Settings" className="flex size-10 items-center justify-center rounded-xl text-muted hover:bg-hover hover:text-fg">
            <Settings className="size-5" />
          </Link>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[252px] shrink-0 border-r border-line bg-sidebar md:block">{sidebar(false)}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal aria-label="Navigation">
          <div className="anim-fade absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="anim-drawer absolute inset-y-0 left-0 w-[280px] border-r border-line bg-sidebar">{sidebar(true)}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur md:px-8">
          <button aria-label="Open menu" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-muted hover:bg-hover hover:text-fg md:hidden">
            <MenuIcon className="size-5" />
          </button>
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1 truncate text-[15px]">
            {project ? (
              <>
                <Link href="/projects" className="text-muted hover:text-fg">
                  Projects
                </Link>
                <span className="mx-2 text-faint">/</span>
                <span className="font-semibold">{project.name}</span>
              </>
            ) : (
              <span className="font-semibold">{TITLES[segment] ?? ""}</span>
            )}
          </nav>
          <button
            onClick={() => setPaletteOpen(true)}
            data-tour="search"
            className="flex h-10 items-center gap-2 rounded-xl border border-line bg-panel px-3 text-[14px] text-faint hover:text-muted sm:w-60"
            aria-label="Search"
          >
            <Search className="size-4" />
            <span className="hidden flex-1 text-left sm:inline">Search</span>
            <kbd className="hidden rounded border border-line px-1.5 text-[11px] text-faint lg:inline">Ctrl K</kbd>
          </button>
          <button onClick={() => setTourOpen(true)} aria-label="Show the tutorial" title="Show the tutorial" className="hidden size-10 items-center justify-center rounded-xl text-muted hover:bg-hover hover:text-fg sm:flex">
            <CircleHelp className="size-5" />
          </button>
          <NotificationBell initialUnread={data.unreadCount} />
          {canWrite(data.role) && (
            <Button
              variant="primary"
              onClick={() => setQuickCreate(true)}
              disabled={!data.projects.some((p) => !p.archived)}
              title={data.projects.some((p) => !p.archived) ? "Create a task" : "Create a project first"}
              data-tour="new-task"
              className="h-10 px-4"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">New task</span>
            </Button>
          )}
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onCreateTask={() => setQuickCreate(true)} />
      <QuickCreateTask open={quickCreate} onClose={() => setQuickCreate(false)} defaultProjectId={project && !project.archived ? project.id : undefined} />
      <NewWorkspaceDialog open={newWorkspace} onClose={() => setNewWorkspace(false)} />
      <Tour open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}

function NewWorkspaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useAppData();
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onClose={onClose} title="New workspace" width={440}>
      <form
        className="flex flex-col gap-4 px-6 py-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await createWorkspace({ name, timezone: data.timezone });
          setBusy(false);
          if (!r.ok) return setError(r.error);
          onClose();
          setName("");
          router.push("/onboarding");
        }}
      >
        <Field label="Workspace name" htmlFor="nw-name">
          <input id="nw-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!name.trim()}>
            Create workspace
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Subscribes to row changes in this workspace and re-renders server data when
 * collaborators change something. Row-level security applies to the stream.
 * If the connection drops, data is still correct on the next navigation or refresh.
 */
function useRealtimeRefresh(workspaceId: string, userId: string, enabled: boolean, refresh: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    let client: ReturnType<typeof browserClient>;
    try {
      client = browserClient();
    } catch {
      return;
    }
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => refreshRef.current(), 400);
    };
    const filter = `workspace_id=eq.${workspaceId}`;
    const channel = client
      .channel(`ws:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_dependencies", filter }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "milestones", filter }, schedule)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` }, schedule)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      client.removeChannel(channel);
    };
  }, [workspaceId, userId, enabled]);
}
