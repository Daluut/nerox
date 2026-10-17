"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/domain/types";

export interface ClientAppData {
  userId: string;
  displayName: string;
  email: string | null;
  role: Role;
  today: string;
  timezone: string;
  workspace: { id: string; name: string };
  workspaces: { id: string; name: string; role: Role }[];
  members: { userId: string; name: string; role: Role; active: boolean }[];
  projects: { id: string; name: string; archived: boolean }[];
  unreadCount: number;
  realtime: boolean;
  tourDone: boolean;
}

const Ctx = createContext<ClientAppData | null>(null);

export function AppDataProvider({ value, children }: { value: ClientAppData; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppData must be used inside the app shell");
  return v;
}

export const canWrite = (role: Role) => role !== "viewer";
export const nameOf = (data: ClientAppData, id: string | null | undefined) =>
  id ? (data.members.find((m) => m.userId === id)?.name ?? "Former member") : "Unassigned";
