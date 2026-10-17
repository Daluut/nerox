"use client";

import { useRouter } from "next/navigation";
import { ProjectCreator } from "@/components/projects/project-creator";

export function NewProject(props: { today: string; currentUserId: string; members: { userId: string; name: string }[] }) {
  const router = useRouter();
  return <ProjectCreator {...props} onCancel={() => router.push("/projects")} />;
}
