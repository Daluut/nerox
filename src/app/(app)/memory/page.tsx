import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ClipboardList, Lightbulb, Ruler } from "lucide-react";
import { getAppContext, memberName } from "@/lib/data/context";
import { loadMemory } from "@/lib/data/memory";
import { formatDate } from "@/lib/domain/dates";
import { can } from "@/lib/domain/permissions";
import { MIN_OBSERVATIONS, MIN_PROJECTS } from "@/lib/memory/engine";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { timeAgo } from "@/components/ui/time";
import { cn } from "@/components/ui/cn";
import { DismissButton, RetroNotes } from "./memory-client";

export const metadata: Metadata = { title: "Memory" };

const TABS = [
  { id: "lessons", label: "Lessons", icon: Lightbulb },
  { id: "estimates", label: "Estimates", icon: Ruler },
  { id: "retros", label: "Retrospectives", icon: ClipboardList },
] as const;

export default async function MemoryPage({ searchParams }: { searchParams: Promise<{ tab?: string; show?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.id === sp.tab) ? sp.tab! : "lessons";
  const ctx = await getAppContext();
  const { report, dismissed, projectNames, notes } = await loadMemory(ctx);
  const editable = can(ctx.role, "task.write");
  const t = report.totals;

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-8 md:px-10">
      <PageHeader
        title="Memory"
        description="Nerox learns from your finished work, so every new project is planned a little better than the last."
        icon={<BookOpen className="size-6" />}
        color="var(--c-memory)"
      />

      <section className="mt-8 rounded-2xl border border-line bg-panel p-6 shadow-card">
        <h2 className="text-[17px] font-semibold">How Memory works</h2>
        <div className="mt-3 grid gap-4 text-[14px] text-muted md:grid-cols-3">
          <p>
            <span className="font-semibold text-fg">It watches finished tasks.</span> For every completed task, Memory notes whether it was done on time and, if you record actual effort, how long it really took
            compared with the estimate.
          </p>
          <p>
            <span className="font-semibold text-fg">It groups similar work.</span> Testing, design, writing, research and so on are recognised from task titles, so patterns show up even across very different projects.
          </p>
          <p>
            <span className="font-semibold text-fg">It only speaks up with proof.</span> A lesson needs at least {MIN_OBSERVATIONS} tasks from {MIN_PROJECTS} or more projects, and always shows how many tasks
            it&apos;s based on.
          </p>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Finished projects", t.completedProjects],
            ["Finished tasks", t.completedTasks],
            ["With due dates", t.withDueDate],
            ["With actual effort", t.withEstimateAndActual],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-raised px-4 py-3">
              <dd className="num text-[24px] font-bold">{v}</dd>
              <dt className="text-[13px] text-muted">{l}</dt>
            </div>
          ))}
        </dl>
      </section>

      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Memory sections">
        {TABS.map((x) => (
          <Link
            key={x.id}
            href={x.id === "lessons" ? "/memory" : `/memory?tab=${x.id}`}
            aria-current={tab === x.id ? "page" : undefined}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[15px] font-semibold",
              tab === x.id ? "bg-c-memory text-white" : "border border-line bg-panel text-muted hover:text-fg",
            )}
          >
            <x.icon className="size-4" /> {x.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "lessons" && (
          <Lessons
            insights={report.insights.filter((i) => (sp.show === "dismissed" ? dismissed.has(i.key) : !dismissed.has(i.key)))}
            dismissedCount={report.insights.filter((i) => dismissed.has(i.key)).length}
            showingDismissed={sp.show === "dismissed"}
            projectNames={projectNames}
            editable={editable}
            today={ctx.today}
            hasData={t.completedTasks > 0}
          />
        )}
        {tab === "estimates" && (
          <Panel title="By kind of work" icon={<Ruler className="size-4" />} accent="var(--c-memory)" bodyClassName="p-0">
            {report.stats.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[14px]">
                  <thead className="border-b border-line text-left text-[13px] text-muted">
                    <tr>
                      <th className="px-5 py-3 font-medium">Kind of work</th>
                      <th className="px-3 py-3 font-medium">Finished</th>
                      <th className="px-3 py-3 font-medium">Took vs estimate</th>
                      <th className="px-3 py-3 font-medium">Finished late</th>
                      <th className="px-3 py-3 font-medium">Enough to learn from?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {report.stats.map((s) => {
                      const enough = s.withEstimate >= MIN_OBSERVATIONS && s.projects >= MIN_PROJECTS;
                      return (
                        <tr key={s.category}>
                          <td className="px-5 py-3 font-semibold">{s.label}</td>
                          <td className="num px-3 py-3">{s.completed}</td>
                          <td className="px-3 py-3">
                            {s.medianRatio === null ? (
                              <span className="text-faint">No actual effort recorded</span>
                            ) : (
                              <span className={s.medianRatio > 1.15 ? "font-semibold text-danger" : s.medianRatio < 0.85 ? "font-semibold text-success" : ""}>
                                {s.medianRatio.toFixed(2)}× <span className="font-normal text-faint">({s.withEstimate} tasks)</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">{s.withDueDate ? `${s.late} of ${s.withDueDate}` : <span className="text-faint">No due dates</span>}</td>
                          <td className="px-3 py-3 text-[13px]">
                            {enough ? (
                              <span className="font-semibold text-success">Yes</span>
                            ) : (
                              <span className="text-muted">
                                Needs {Math.max(0, MIN_OBSERVATIONS - s.withEstimate)} more with effort{s.projects < MIN_PROJECTS ? `, from ${MIN_PROJECTS - s.projects} more project` : ""}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="border-t border-line px-5 py-3 text-[13px] text-muted">
                  &ldquo;Took vs estimate&rdquo; is the typical (median) task: 1.00× means spot on, 1.50× means half as long again. Record &ldquo;Actual effort&rdquo; on a task when you finish it to feed this table.
                </p>
              </div>
            ) : (
              <p className="p-5 text-[15px] text-muted">Nothing has been finished yet. Complete a few tasks, and record how long they actually took, to start building this picture.</p>
            )}
          </Panel>
        )}
        {tab === "retros" && (
          <div className="flex flex-col gap-4">
            {report.retrospectives.length ? (
              report.retrospectives.map((r) => {
                const n = notes.get(r.projectId);
                return (
                  <Panel
                    key={r.projectId}
                    title={r.projectName}
                    icon={<ClipboardList className="size-4" />}
                    accent="var(--c-memory)"
                    action={<span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", r.completed ? "bg-success-soft text-success" : "bg-raised text-muted")}>{r.completed ? "Finished" : "In progress"}</span>}
                  >
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Fact label="Tasks done" value={`${r.tasksDone} of ${r.tasksTotal}`} />
                      <Fact label="On time" value={r.onTimeShare === null ? "—" : `${Math.round(r.onTimeShare * 100)}%`} />
                      <Fact label="Took vs estimate" value={r.estimateRatio === null ? "—" : `${r.estimateRatio.toFixed(2)}×`} />
                      <Fact
                        label="Deadline"
                        value={r.daysVsDeadline === null ? (r.deadline ? formatDate(r.deadline, ctx.today) : "None") : r.daysVsDeadline > 0 ? `${r.daysVsDeadline} days late` : "Met"}
                        bad={(r.daysVsDeadline ?? 0) > 0}
                      />
                    </dl>
                    {(r.lateTasks.length > 0 || r.overruns.length > 0) && (
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {r.lateTasks.length > 0 && (
                          <div>
                            <p className="text-[13px] font-semibold text-muted">Finished late</p>
                            <ul className="mt-1 space-y-1 text-[14px]">
                              {r.lateTasks.map((x) => (
                                <li key={x.id}>
                                  <Link href={`/projects/${r.projectId}?task=${x.id}`} className="hover:underline">
                                    {x.title}
                                  </Link>{" "}
                                  <span className="text-danger">+{x.daysLate}d</span>
                                  {x.blocked > 0 && <span className="text-muted">, held up {x.blocked}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {r.overruns.length > 0 && (
                          <div>
                            <p className="text-[13px] font-semibold text-muted">Took much longer than estimated</p>
                            <ul className="mt-1 space-y-1 text-[14px]">
                              {r.overruns.map((x) => (
                                <li key={x.id}>
                                  {x.title}{" "}
                                  <span className="text-muted">
                                    {x.estimate}h estimated, {x.actual}h actual
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    <RetroNotes projectId={r.projectId} wentWell={n?.wentWell ?? ""} toImprove={n?.toImprove ?? ""} editable={editable} />
                    {n?.updatedAt && (
                      <p className="mt-2 text-[12px] text-faint">
                        Notes last edited by {memberName(ctx, n.updatedBy)} {timeAgo(n.updatedAt)}
                      </p>
                    )}
                  </Panel>
                );
              })
            ) : (
              <p className="rounded-2xl border border-line bg-panel p-6 text-[15px] text-muted">A retrospective appears for each project once some of its tasks are done.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="rounded-xl bg-raised px-3 py-2.5">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={cn("text-[17px] font-bold", bad && "text-danger")}>{value}</dd>
    </div>
  );
}

function Lessons({
  insights,
  dismissedCount,
  showingDismissed,
  projectNames,
  editable,
  today,
  hasData,
}: {
  insights: Awaited<ReturnType<typeof loadMemory>>["report"]["insights"];
  dismissedCount: number;
  showingDismissed: boolean;
  projectNames: Map<string, string>;
  editable: boolean;
  today: string;
  hasData: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {insights.length ? (
        insights.map((i) => (
          <article key={i.key} className="rounded-2xl border border-line bg-panel p-6 shadow-card">
            <div className="flex items-start gap-3">
              <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", i.tone === "warning" ? "bg-warning" : "bg-success")} />
              <div className="flex-1">
                <h3 className="text-[18px] font-bold leading-snug">{i.title}</h3>
                <p className="mt-1 text-[15px] text-muted">{i.detail}</p>
                <p className="mt-3 rounded-xl bg-raised px-4 py-3 text-[15px]">
                  <span className="font-semibold">Next time: </span>
                  {i.suggestion}
                </p>
                <p className="mt-3 text-[13px] text-faint">
                  Based on {i.observations} {i.observations === 1 ? "observation" : "observations"}
                  {i.period ? `, ${formatDate(i.period.from, today)} to ${formatDate(i.period.to, today)}` : ""}. From:{" "}
                  {i.projectIds.map((id, n) => (
                    <span key={id}>
                      {n > 0 && ", "}
                      <Link href={`/projects/${id}`} className="text-violet hover:underline">
                        {projectNames.get(id) ?? "a project"}
                      </Link>
                    </span>
                  ))}
                </p>
              </div>
              {editable && <DismissButton insightKey={i.key} dismissed={showingDismissed} />}
            </div>
          </article>
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center">
          <p className="text-[18px] font-semibold">{showingDismissed ? "Nothing dismissed" : "No lessons yet"}</p>
          <p className="mx-auto mt-2 max-w-lg text-[15px] text-muted">
            {showingDismissed
              ? "Lessons you dismiss are kept here in case you change your mind."
              : hasData
                ? `Memory needs at least ${MIN_OBSERVATIONS} finished tasks of the same kind, from ${MIN_PROJECTS} or more projects, before it draws a conclusion. Check the Estimates tab to see how close you are.`
                : "Finish some tasks and Memory will start looking for patterns. Recording how long tasks actually took makes it much smarter."}
          </p>
        </div>
      )}
      {(dismissedCount > 0 || showingDismissed) && (
        <Link href={showingDismissed ? "/memory" : "/memory?show=dismissed"} className="text-[14px] font-medium text-violet hover:underline">
          {showingDismissed ? "Back to current lessons" : `Show ${dismissedCount} dismissed`}
        </Link>
      )}
    </div>
  );
}
