"use client";

import { useState } from "react";
import { deleteWorkspace, updateProfile, updatePulseWeights, updateWorkspace } from "@/lib/actions/workspace";
import { DEFAULT_CONFIG, FACTOR_KEYS, FACTOR_LABEL, FACTOR_QUESTION, type FactorKey } from "@/lib/pulse/config";
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
  plan: "early_access" | "free" | "pro";
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

      <Panel title="Your plan">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[18px] font-bold">
              {props.plan === "pro" ? "Pro" : "Free"}
              {props.plan === "early_access" && <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-[12px] font-semibold text-success">Early access</span>}
            </p>
            <p className="mt-1 text-[14px] text-muted">
              {props.plan === "early_access"
                ? "Every feature is included while payments aren't switched on."
                : props.plan === "pro"
                  ? "Unlimited people, full Nerox AI answers and spreadsheet export."
                  : "Upgrade to Pro for unlimited people, full Nerox AI answers and spreadsheet export."}
            </p>
          </div>
          <a href="/settings/billing" className="inline-flex h-11 items-center rounded-xl bg-violet px-5 text-[15px] font-semibold text-white hover:bg-violet-strong">
            {props.plan === "free" ? "Upgrade" : "Billing"}
          </a>
        </div>
      </Panel>

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
        <div className="mb-5 space-y-3 text-[14px] text-muted">
          <p>
            <span className="font-semibold text-fg">What this is:</span> each project&apos;s health score (0 to 100) is built from seven checks. These sliders decide how much each check counts
            towards that score.
          </p>
          <p>
            <span className="font-semibold text-fg">How to use it:</span> slide a check up if it really matters to your team, and down (even to zero) if it doesn&apos;t. The percentage on the right is
            that check&apos;s share of the score. For example, a student team with a hard hand-in date might turn up &ldquo;Deadline feasibility&rdquo;; a team without set roles might turn down
            &ldquo;Workload balance&rdquo;.
          </p>
          <p>
            <span className="font-semibold text-fg">What it doesn&apos;t change:</span> Pulse still finds and lists the same risks. Weighting only changes how the final number is added up. If you&apos;re
            not sure, leave the defaults.
          </p>
        </div>
        <ul className="flex flex-col gap-4">
          {FACTOR_KEYS.map((k) => (
            <li key={k} className="grid grid-cols-[1fr_120px_44px] items-center gap-3 sm:grid-cols-[1fr_160px_48px]">
              <label htmlFor={`w-${k}`}>
                <span className="block text-[15px] font-semibold">{FACTOR_LABEL[k]}</span>
                <span className="block text-[13px] text-muted">{FACTOR_QUESTION[k]}</span>
              </label>
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
              <span className="num text-right text-[15px] font-semibold">{total ? Math.round((weights[k] / total) * 100) : 0}%</span>
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
