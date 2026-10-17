import type { Metadata } from "next";
import { getAppContext } from "@/lib/data/context";
import { can } from "@/lib/domain/permissions";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await getAppContext();
  return (
    <SettingsView
      profileName={ctx.displayName}
      email={ctx.email}
      workspaceName={ctx.workspace.name}
      timezone={ctx.timezone}
      weights={ctx.pulseConfig.weights}
      customWeights={!!(ctx.workspace.settings.pulse as { weights?: unknown } | undefined)?.weights}
      canManage={can(ctx.role, "workspace.manage")}
      isOwner={ctx.role === "owner"}
    />
  );
}
