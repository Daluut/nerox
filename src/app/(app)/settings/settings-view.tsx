"use client";

import { useState } from "react";
import { deleteWorkspace, updateProfile, updatePulseWeights, updateWorkspace } from "@/lib/actions/workspace";
import { DEFAULT_CONFIG, FACTOR_KEYS, FACTOR_LABEL, type FactorKey } from "@/lib/pulse/config";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button, ErrorNote, Field, PageHeader, Panel } from "@/components/ui/primitives";
import { ThemePicker } from "@/components/ui/theme-picker";
import { Settings as SettingsIcon } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const ZONES = ["Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney", "UTC"];

export function SettingsView(props: {
  profileName: string;
  email: string | null;
  workspaceName: string;
  timezone: string;
  weights: Record<FactorKey, number>;
  customWeights: boolean;
  canManage: boolean;
  isOwner: boolean;
}) {
  const toast = useToast();
  const [name, setName] = useState(props.profileName);
  const [ws, setWs] = useState({ name: props.workspaceName, timezone: props.timezone });
  const [weights, setWeights] = useState(props.weights);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);
  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  const zones = ZONES.includes(ws.timezone) ? ZONES : [ws.timezone, ...ZONES];

  async function act(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(key);
    setError((e) => ({ ...e, [key]: "" }));
    const r = await fn();
    setBusy(null);
    if (!r.ok) setError((e) => ({ ...e, [key]: r.error ?? "Something went wrong." }));
    else toast.success(success);
  }

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-8 md:px-10">
      <PageHeader title="Settings" description="Your profile, colours and workspace." icon={<SettingsIcon className="size-6" />} color="var(--c-about)" />

      <Panel title="Colours">
        <p className="mb-4 text-[14px] text-muted">Pick how Nerox looks on this device.</p>
        <ThemePicker />
      </Panel>

      <Panel title="Your profile">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            act("profile", () => updateProfile({ name }), "Profile updated.");
          }}
        >
          <Field label="Display name" htmlFor="s-name">
            <input id="s-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </Field>
          <p className="text-[12px] text-faint">Signed in as {props.email}.</p>
          {error.profile && <ErrorNote>{error.profile}</ErrorNote>}
          <Button type="submit" size="sm" className="self-start" loading={busy === "profile"}>
            Save profile
          </Button>
        </form>
      </Panel>

      <Panel title="Workspace">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            act("ws", () => updateWorkspace(ws), "Workspace updated.");
          }}
        >
          <Field label="Workspace name" htmlFor="s-ws">
            <input id="s-ws" className="field" value={ws.name} disabled={!props.canManage} onChange={(e) => setWs({ ...ws, name: e.target.value })} maxLength={80} required />
          </Field>
          <Field label="Timezone" htmlFor="s-tz" hint="Decides when “today” starts, and so when tasks become overdue.">
            <select id="s-tz" className="field" value={ws.timezone} disabled={!props.canManage} onChange={(e) => setWs({ ...ws, timezone: e.target.value })}>
              {zones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </Field>
          {error.ws && <ErrorNote>{error.ws}</ErrorNote>}
          {props.canManage ? (
            <Button type="submit" size="sm" className="self-start" loading={busy === "ws"}>
              Save workspace
            </Button>
          ) : (
            <p className="text-[12px] text-faint">Only owners and admins can change workspace settings.</p>
          )}
        </form>
      </Panel>

      <Panel title="Pulse weighting">
        <p className="mb-4 text-[13px] text-muted">
          How much each factor counts toward a project&apos;s health score. These are starting defaults, not established science — adjust them if your team cares more about some signals than others. Weights are relative; they don&apos;t need to add up to 100.
        </p>
        <ul className="flex flex-col gap-3">
          {FACTOR_KEYS.map((k) => (
            <li key={k} className="grid grid-cols-[1fr_140px_44px] items-center gap-3 text-[13px]">
              <label htmlFor={`w-${k}`}>{FACTOR_LABEL[k]}</label>
              <input
                id={`w-${k}`}
                type="range"
                min={0}
                max={50}
                step={1}
                value={weights[k]}
                disabled={!props.canManage}
                onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })}
                className="accent-[var(--violet)]"
              />
              <span className="num text-right text-muted">{total ? Math.round((weights[k] / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
        {error.pulse && (
          <div className="mt-3">
            <ErrorNote>{error.pulse}</ErrorNote>
          </div>
        )}
        {props.canManage && (
          <div className="mt-4 flex gap-2">
            <Button size="sm" loading={busy === "pulse"} onClick={() => act("pulse", () => updatePulseWeights(weights), "Pulse weighting saved. Scores now use the new weights.")}>
              Save weighting
            </Button>
            {(props.customWeights || JSON.stringify(weights) !== JSON.stringify(DEFAULT_CONFIG.weights)) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setWeights(DEFAULT_CONFIG.weights);
                  act("pulse", () => updatePulseWeights(null), "Pulse weighting reset to defaults.");
                }}
              >
                Reset to defaults
              </Button>
            )}
          </div>
        )}
      </Panel>

      {props.isOwner && (
        <Panel title="Delete workspace" className="border-danger/30">
          <p className="text-[13px] text-muted">Permanently deletes this workspace with every project, task, comment and Pulse record in it. Members lose access immediately.</p>
          <Button variant="danger" size="sm" className="mt-4" onClick={() => setDeleting(true)}>
            Delete workspace
          </Button>
          <ConfirmDialog
            open={deleting}
            onClose={() => setDeleting(false)}
            title="Delete this workspace?"
            body="This can't be undone."
            confirmLabel="Delete workspace"
            danger
            requireText={props.workspaceName}
            onConfirm={async (typed) => {
              const r = await deleteWorkspace(typed);
              return r && !r.ok ? r.error : null;
            }}
          />
        </Panel>
      )}
    </div>
  );
}
