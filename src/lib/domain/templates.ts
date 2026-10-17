import { addDays, daysBetween } from "./dates";
import type { DateOnly, Priority } from "./types";

/**
 * Project templates. Positions are fractions of the project's duration so a
 * template fits any start date and deadline. They give a sensible starting
 * point — tasks are unassigned and fully editable.
 */
export interface TemplateTask {
  key: string;
  title: string;
  priority: Priority;
  start: number; // fraction of the project duration
  end: number;
  estimateHours?: number;
  dependsOn?: string[];
}

export interface TemplateMilestone {
  name: string;
  at: number;
}

export interface ProjectTemplate {
  id: "software" | "assignment" | "startup" | "general";
  name: string;
  description: string;
  tasks: TemplateTask[];
  milestones: TemplateMilestone[];
}

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: "software",
    name: "Software Project",
    description: "Design, build, integrate and test an application.",
    tasks: [
      { key: "scope", title: "Define requirements and scope", priority: "high", start: 0, end: 0.1, estimateHours: 6 },
      { key: "db", title: "Design database schema", priority: "high", start: 0.08, end: 0.22, estimateHours: 10, dependsOn: ["scope"] },
      { key: "api", title: "Implement API", priority: "high", start: 0.2, end: 0.5, estimateHours: 24, dependsOn: ["db"] },
      { key: "ui", title: "Build frontend UI", priority: "medium", start: 0.2, end: 0.55, estimateHours: 24, dependsOn: ["scope"] },
      { key: "integ", title: "Integrate frontend with API", priority: "high", start: 0.5, end: 0.7, estimateHours: 14, dependsOn: ["api", "ui"] },
      { key: "test", title: "Testing and QA", priority: "high", start: 0.68, end: 0.88, estimateHours: 14, dependsOn: ["integ"] },
      { key: "docs", title: "Write documentation", priority: "medium", start: 0.7, end: 0.9, estimateHours: 6, dependsOn: ["integ"] },
      { key: "ship", title: "Final delivery", priority: "urgent", start: 0.92, end: 1, estimateHours: 4, dependsOn: ["test", "docs"] },
    ],
    milestones: [
      { name: "Feature complete", at: 0.7 },
      { name: "Release", at: 1 },
    ],
  },
  {
    id: "assignment",
    name: "University Assignment",
    description: "Research, draft, review and submit coursework.",
    tasks: [
      { key: "brief", title: "Read and understand the brief", priority: "high", start: 0, end: 0.08, estimateHours: 2 },
      { key: "research", title: "Research and gather sources", priority: "medium", start: 0.05, end: 0.35, estimateHours: 10, dependsOn: ["brief"] },
      { key: "outline", title: "Write outline", priority: "medium", start: 0.3, end: 0.42, estimateHours: 3, dependsOn: ["research"] },
      { key: "draft", title: "Write first draft", priority: "high", start: 0.4, end: 0.7, estimateHours: 14, dependsOn: ["outline"] },
      { key: "review", title: "Peer review", priority: "medium", start: 0.7, end: 0.8, estimateHours: 3, dependsOn: ["draft"] },
      { key: "revise", title: "Revise and edit", priority: "high", start: 0.78, end: 0.92, estimateHours: 6, dependsOn: ["review"] },
      { key: "refs", title: "References and formatting", priority: "medium", start: 0.85, end: 0.95, estimateHours: 2, dependsOn: ["draft"] },
      { key: "submit", title: "Submit", priority: "urgent", start: 0.97, end: 1, estimateHours: 1, dependsOn: ["revise", "refs"] },
    ],
    milestones: [{ name: "Draft complete", at: 0.7 }],
  },
  {
    id: "startup",
    name: "Startup Launch",
    description: "Take a product from positioning to launch day.",
    tasks: [
      { key: "icp", title: "Define target customer and positioning", priority: "high", start: 0, end: 0.15, estimateHours: 8 },
      { key: "pricing", title: "Decide pricing", priority: "medium", start: 0.12, end: 0.3, estimateHours: 6, dependsOn: ["icp"] },
      { key: "landing", title: "Build landing page", priority: "high", start: 0.15, end: 0.45, estimateHours: 16, dependsOn: ["icp"] },
      { key: "beta", title: "Onboard beta users", priority: "high", start: 0.4, end: 0.75, estimateHours: 20, dependsOn: ["landing"] },
      { key: "content", title: "Prepare launch content", priority: "medium", start: 0.6, end: 0.9, estimateHours: 12, dependsOn: ["pricing"] },
      { key: "launch", title: "Launch day", priority: "urgent", start: 0.95, end: 1, estimateHours: 6, dependsOn: ["beta", "content"] },
    ],
    milestones: [
      { name: "Beta open", at: 0.45 },
      { name: "Public launch", at: 1 },
    ],
  },
  {
    id: "general",
    name: "General Project",
    description: "A light structure for any kind of work.",
    tasks: [
      { key: "kickoff", title: "Kick-off and goals", priority: "medium", start: 0, end: 0.1 },
      { key: "plan", title: "Plan the work", priority: "medium", start: 0.08, end: 0.2, dependsOn: ["kickoff"] },
      { key: "exec", title: "Do the main work", priority: "high", start: 0.2, end: 0.8, dependsOn: ["plan"] },
      { key: "review", title: "Review outcomes", priority: "medium", start: 0.8, end: 0.92, dependsOn: ["exec"] },
      { key: "wrap", title: "Wrap up and hand over", priority: "medium", start: 0.92, end: 1, dependsOn: ["review"] },
    ],
    milestones: [],
  },
];

export function getTemplate(id: string | null | undefined) {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

export interface MaterialisedTask {
  key: string;
  title: string;
  priority: Priority;
  startDate: DateOnly | null;
  dueDate: DateOnly | null;
  estimateHours: number | null;
  dependsOn: string[];
}

/** Places template tasks and milestones on real dates between start and deadline. */
export function materialiseTemplate(
  template: ProjectTemplate,
  start: DateOnly,
  deadline: DateOnly | null,
): { tasks: MaterialisedTask[]; milestones: { name: string; targetDate: DateOnly | null }[] } {
  const span = deadline ? Math.max(1, daysBetween(start, deadline)) : null;
  const at = (f: number) => (span === null ? null : addDays(start, Math.round(f * span)));
  return {
    tasks: template.tasks.map((t) => ({
      key: t.key,
      title: t.title,
      priority: t.priority,
      startDate: at(t.start),
      dueDate: at(t.end),
      estimateHours: t.estimateHours ?? null,
      dependsOn: t.dependsOn ?? [],
    })),
    milestones: template.milestones.map((m) => ({ name: m.name, targetDate: at(m.at) })),
  };
}
