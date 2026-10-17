import type { Metadata } from "next";
import { requireUser } from "@/lib/data/context";
import { todayInTimeZone } from "@/lib/domain/dates";
import { Onboarding } from "./onboarding";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const [{ count }, { data: profile }] = await Promise.all([
    supabase.from("workspace_members").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active"),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
  ]);
  // People who already belong to a workspace skip straight to creating a project.
  return (
    <Onboarding
      name={profile?.display_name || user.email?.split("@")[0] || ""}
      userId={user.id}
      today={todayInTimeZone("Europe/London")}
      startAtProject={!!count}
    />
  );
}
