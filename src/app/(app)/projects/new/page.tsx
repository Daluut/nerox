import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { activeMembers, getAppContext } from "@/lib/data/context";
import { can } from "@/lib/domain/permissions";
import { NewProject } from "./new-project";
import { FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  const ctx = await getAppContext();
  if (!can(ctx.role, "project.create")) redirect("/projects");
  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 md:px-10">
      <div className="mb-8">
        <PageHeader title="New project" description="Two quick steps: the basics, then your starting tasks." icon={<FolderKanban className="size-6" />} color="var(--c-projects)" />
      </div>
      <div className="rounded-2xl border border-line bg-panel p-6 shadow-card">
      <NewProject today={ctx.today} currentUserId={ctx.userId} members={activeMembers(ctx).map((m) => ({ userId: m.userId, name: m.name }))} />
      </div>
    </div>
  );
}
