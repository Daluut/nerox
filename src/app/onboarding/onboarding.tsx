"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, GitBranch, ListChecks } from "lucide-react";
import { createWorkspace } from "@/lib/actions/workspace";
import { todayInTimeZone } from "@/lib/domain/dates";
import { Logo } from "@/components/shell/logo";
import { ProjectCreator } from "@/components/projects/project-creator";
import { Button, ErrorNote, Field } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";

const STEPS = ["Welcome", "Workspace", "First project"] as const;

const TIMEZONES = ["Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney", "UTC"];

export function Onboarding({ name, userId, today, startAtProject }: { name: string; userId: string; today: string; startAtProject: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(startAtProject ? 2 : 0);
  const [wsName, setWsName] = useState(name ? `${name.split(" ")[0]}'s workspace` : "");
  const [timezone, setTimezone] = useState("Europe/London");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localToday, setLocalToday] = useState(today);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) setTimezone(tz);
  }, []);
  useEffect(() => setLocalToday(todayInTimeZone(timezone)), [timezone]);

  async function saveWorkspace() {
    setBusy(true);
    setError(null);
    const r = await createWorkspace({ name: wsName, timezone }).catch(() => ({ ok: false as const, error: "Couldn't reach Nerox. Try again." }));
    setBusy(false);
    if (!r.ok) setError(r.error);
    else setStep(2);
  }

  const zones = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES];

  return (
    <main className="mx-auto min-h-dvh max-w-[720px] px-5 py-10 sm:py-14">
      <div className="flex items-center justify-between">
        <Logo />
        <ol className="flex items-center gap-4 text-[12px]" aria-label="Setup progress">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className={cn("flex items-center gap-1.5", i === step ? "text-fg" : i < step ? "text-muted" : "text-faint")}>
              <span className={cn("size-1.5 rounded-full", i <= step ? "bg-violet" : "bg-line-strong")} />
              <span className="hidden sm:inline">{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-14 sm:mt-20">
        {step === 0 && (
          <section className="anim-fade max-w-lg">
            <h1 className="text-[34px] font-semibold leading-tight">Your projects, understood.</h1>
            <p className="mt-4 text-[15px] text-muted">
              {name ? `Hi ${name.split(" ")[0]}. ` : ""}Nerox keeps your team&apos;s work in one place and keeps an eye on it for you, so problems show up while there&apos;s still time to fix them.
            </p>
            <ul className="mt-8 flex flex-col gap-4 text-[14px]">
              <li className="flex gap-3">
                <ListChecks className="mt-0.5 size-4 shrink-0 text-violet-strong" />
                <span>
                  <span className="font-medium">Organise the work.</span> <span className="text-muted">Tasks, owners, deadlines and what depends on what.</span>
                </span>
              </li>
              <li className="flex gap-3">
                <Activity className="mt-0.5 size-4 shrink-0 text-violet-strong" />
                <span>
                  <span className="font-medium">See the project&apos;s health.</span>{" "}
                  <span className="text-muted">Pulse scores each project and explains exactly why — overdue work, stalled tasks, overloaded people.</span>
                </span>
              </li>
              <li className="flex gap-3">
                <GitBranch className="mt-0.5 size-4 shrink-0 text-violet-strong" />
                <span>
                  <span className="font-medium">Catch knock-on effects.</span> <span className="text-muted">When one task slips, see which work it holds up.</span>
                </span>
              </li>
            </ul>
            <Button variant="primary" className="mt-10" onClick={() => setStep(1)}>
              Set up my workspace
            </Button>
          </section>
        )}

        {step === 1 && (
          <section className="anim-fade max-w-md">
            <h1 className="text-[24px] font-semibold">Create a workspace</h1>
            <p className="mt-2 text-muted">A workspace holds your projects and the people you work with. You can invite your team once it&apos;s set up.</p>
            <form
              className="mt-8 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveWorkspace();
              }}
            >
              <Field label="Workspace name" htmlFor="ws-name" hint="Your team, class or company name works well.">
                <input id="ws-name" className="field" value={wsName} onChange={(e) => setWsName(e.target.value)} maxLength={80} required autoFocus />
              </Field>
              <Field label="Timezone" htmlFor="ws-tz" hint="Used to decide when a task becomes overdue.">
                <select id="ws-tz" className="field" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {zones.map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </Field>
              {error && <ErrorNote>{error}</ErrorNote>}
              <div className="mt-2 flex items-center gap-2">
                <Button type="submit" variant="primary" loading={busy} disabled={!wsName.trim()}>
                  Create workspace
                </Button>
                <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                  Back
                </Button>
              </div>
              <p className="mt-4 text-[13px] text-faint">Joining a team instead? Open the invitation link you were sent.</p>
            </form>
          </section>
        )}

        {step === 2 && (
          <section className="anim-fade">
            <h1 className="text-[24px] font-semibold">Start your first project</h1>
            <p className="mb-8 mt-2 text-muted">Pick a template to get sensible starting tasks, or begin blank.</p>
            <ProjectCreator today={localToday} members={[{ userId, name: name || "You" }]} currentUserId={userId} />
            <button onClick={() => router.push("/overview")} className="mt-6 text-[13px] text-faint hover:text-muted">
              Skip for now
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
