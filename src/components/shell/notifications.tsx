"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { listNotifications, markNotificationsRead } from "@/lib/actions/misc";
import type { Notification } from "@/lib/data/types";
import { cn } from "@/components/ui/cn";
import { timeAgo } from "@/components/ui/time";

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUnread(initialUnread);
  }, [initialUnread]);
  useEffect(() => {
    if (!open) return;
    setFailed(false);
    listNotifications()
      .then((r) => (r.ok ? setItems(r.data) : setFailed(true)))
      .catch(() => setFailed(true));
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  async function markAll() {
    const r = await markNotificationsRead("all");
    if (r.ok) {
      setItems((xs) => xs?.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) ?? null);
      setUnread(0);
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative flex size-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
      >
        <Bell className="size-4" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-violet ring-2 ring-bg" />}
      </button>
      {open && (
        <div className="anim-fade absolute right-0 z-40 mt-2 w-[min(360px,calc(100vw-24px))] rounded-lg border border-line-strong bg-raised shadow-[0_16px_40px_rgb(0_0_0/0.5)]">
          <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
            <span className="text-[13px] font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-[12px] text-muted hover:text-fg">
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-[420px] overflow-y-auto py-1">
            {failed && <li className="px-3.5 py-3 text-[13px] text-danger">Couldn&apos;t load notifications.</li>}
            {!failed && items === null && <li className="px-3.5 py-3 text-[13px] text-faint">Loading…</li>}
            {items?.length === 0 && (
              <li className="px-3.5 py-4 text-[13px] text-muted">You&apos;re up to date. Assignments, comments on your tasks and completed milestones show up here.</li>
            )}
            {items?.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.link}
                  onClick={() => {
                    setOpen(false);
                    if (!n.readAt) {
                      markNotificationsRead([n.id]);
                      setUnread((u) => Math.max(0, u - 1));
                    }
                  }}
                  className="flex gap-2.5 px-3.5 py-2.5 hover:bg-hover"
                >
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-violet")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[13px]", n.readAt ? "text-muted" : "text-fg")}>{n.title}</span>
                    <span className="text-[11px] text-faint">{timeAgo(n.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
