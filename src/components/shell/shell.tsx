"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  FolderKanban,
  LayoutGrid,
  LogOut,
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
import { QuickCreateTask } from "@/components/tasks/quick-create";
import { Avatar, Button, ErrorNote, Field } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { Menu } from "@/components/ui/menu";
import { cn } from "@/components/ui/cn";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutGrid },
  { href: "/my-tasks", label: "My Tasks", icon: CheckSquare },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/pulse", label: "Nerox Pulse", icon: Activity },
  { href: "/what-if", label: "What If?", icon: Split, planned: true },
  { href: "/memory", label: "Nerox Memory", icon: BookOpen, planned: true },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

const TITLES: Record<string, string> = {
  overview: "Overview",
  "my-tasks": "My Tasks",
  projects: "Projects",
  pulse: "Nerox Pulse",
  "what-if": "What If?",
  memory: "Nerox Memory",
  team: "Team",
  settings: "Settings",
};

export function Shell({ children }: { children: React.ReactNode }) {
  const data = useAppData();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickCreate, setQuickCreate] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("nerox:sidebar") === "collapsed");
    } catch {}
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

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

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("nerox:sidebar", c ? "expanded" : "collapsed");
      } catch {}
      return !c;
    });
  };

  const segment = pathname.split("/")[1] ?? "";
  const projectId = segment === "projects" ? pathname.split("/")[2] : undefined;
  const project = projectId ? data.projects.find((p) => p.id === projectId) : undefined;

  const sidebar = (isMobile: boolean) => (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className={cn("flex h-14 shrink-0 items-center border-b border-line", collapsed && !isMobile ? "justify-center px-0" : "justify-between px-4")}>
        <Link href="/overview" aria-label="Nerox home">
          <Logo collapsed={collapsed && !isMobile} />
        </Link>
        {isMobile && (
          <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="rounded p-1 text-muted hover:text-fg">
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className={cn("px-2 pt-3", collapsed && !isMobile && "px-1.5")}>
        <Menu
          label="Switch workspace"
          align="start"
          trigger={
            <span className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left", collapsed && !isMobile ? "w-10 justify-center" : "w-[204px]")}>
              <span className="flex size-5 shrink-0 items-center justify-center rounded bg-violet-soft text-[11px] font-semibold text-violet-strong">
                {data.workspace.name[0]?.toUpperCase()}
              </span>
              {!(collapsed && !isMobile) && (
                <>
                  <span className="flex-1 truncate text-[13px] font-medium text-fg">{data.workspace.name}</span>
                  <ChevronsUpDown className="size-3.5 text-faint" />
                </>
              )}
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
      <ul className="mt-3 flex flex-1 flex-col gap-0.5 px-2">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const compact = collapsed && !isMobile;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={compact ? item.label : undefined}
                className={cn(
                  "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
                  active ? "bg-hover font-medium text-fg" : "text-muted hover:bg-hover/60 hover:text-fg",
                  compact && "justify-center px-0",
                )}
              >
                {active && <span className="absolute -left-2 top-1.5 h-5 w-[3px] rounded-r bg-violet" aria-hidden />}
                <Icon className={cn("size-4 shrink-0", active ? "text-violet-strong" : "text-faint group-hover:text-muted")} />
                {!compact && <span className="flex-1">{item.label}</span>}
                {!compact && item.planned && <span className="rounded border border-line-strong px-1 text-[10px] text-faint">Planned</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line p-2">
        <Menu
          label="Account menu"
          align="start"
          trigger={
            <span className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5", collapsed && !isMobile ? "w-10 justify-center px-0" : "w-[204px]")}>
              <Avatar name={data.displayName} size={26} />
              {!(collapsed && !isMobile) && (
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13px] font-medium text-fg">{data.displayName}</span>
                  <span className="block truncate text-[11px] capitalize text-faint">{data.role}</span>
                </span>
              )}
            </span>
          }
          items={[
            { label: "Profile and settings", icon: <Settings className="size-3.5" />, onSelect: () => router.push("/settings") },
            { label: "Sign out", icon: <LogOut className="size-3.5" />, onSelect: () => signOut() },
          ]}
        />
        {!isMobile && (
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn("mt-1 flex h-7 w-full items-center gap-2 rounded-md px-2.5 text-[12px] text-faint hover:bg-hover hover:text-muted", collapsed && "justify-center px-0")}
          >
            {collapsed ? <ChevronsRight className="size-3.5" /> : <ChevronsLeft className="size-3.5" />}
            {!collapsed && "Collapse"}
          </button>
        )}
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 border-r border-line bg-sidebar transition-[width] duration-150 md:block", collapsed ? "w-[60px]" : "w-[232px]")}>
        {sidebar(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal aria-label="Navigation">
          <div className="anim-fade absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="anim-drawer absolute inset-y-0 left-0 w-[260px] border-r border-line bg-sidebar">{sidebar(true)}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur md:px-6">
          <button aria-label="Open menu" onClick={() => setMobileOpen(true)} className="rounded p-1 text-muted hover:text-fg md:hidden">
            <MenuIcon className="size-5" />
          </button>
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1 truncate text-[14px]">
            {project ? (
              <>
                <Link href="/projects" className="text-muted hover:text-fg">
                  Projects
                </Link>
                <span className="mx-2 text-faint">/</span>
                <span className="font-medium">{project.name}</span>
              </>
            ) : (
              <span className="font-medium">{TITLES[segment] ?? ""}</span>
            )}
          </nav>
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-8 items-center gap-2 rounded-md border border-line-strong bg-panel px-2.5 text-[13px] text-faint hover:text-muted sm:w-56"
            aria-label="Search"
          >
            <Search className="size-3.5" />
            <span className="hidden flex-1 text-left sm:inline">Search</span>
            <kbd className="hidden text-[11px] text-faint sm:inline">Ctrl K</kbd>
          </button>
          <NotificationBell initialUnread={data.unreadCount} />
          {canWrite(data.role) && (
            <Button variant="primary" size="sm" onClick={() => setQuickCreate(true)} disabled={!data.projects.some((p) => !p.archived)} title="Create task">
              <Plus className="size-3.5" />
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
    <Dialog open={open} onClose={onClose} title="New workspace" width={420}>
      <form
        className="flex flex-col gap-4 px-5 py-4"
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
