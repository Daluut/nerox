import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { activeMembers, getAppContext } from "@/lib/data/context";
import { can } from "@/lib/domain/permissions";
import { NewProject } from "./new-project";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  const ctx = await getAppContext();
  if (!can(ctx.role, "project.create")) redirect("/projects");
  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 md:px-8 md:py-10">
      <h1 className="mb-1 text-[22px] font-semibold">New project</h1>
      <p className="mb-8 text-muted">Set the basics, then review the starting tasks.</p>
      <NewProject today={ctx.today} currentUserId={ctx.userId} members={activeMembers(ctx).map((m) => ({ userId: m.userId, name: m.name }))} />
    </div>
  );
}
