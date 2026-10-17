import { z } from "zod";
import { isValidDateOnly, isValidTimeZone } from "./domain/dates";
import { PRIORITIES, PROJECT_STATUSES, TASK_STATUSES } from "./domain/types";

/** Server-side input schemas. Every server action validates with one of these. */

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const uuid = z.string().uuid("Invalid reference.");
export const optionalUuid = z.union([uuid, z.literal(""), z.null()]).transform((v) => (v ? v : null));

export const dateOnly = z
  .union([z.string(), z.null()])
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isValidDateOnly(v), "Enter a valid date.");

const hours = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => (v === "" || v === null ? null : Number(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 10000), "Enter hours between 0 and 10,000.");

export const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
export const password = z.string().min(8, "Use at least 8 characters.").max(128);

export const signUpSchema = z.object({ name: trimmed(1, 80, "Name"), email, password });
export const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password.") });

export const workspaceSchema = z.object({
  name: trimmed(1, 80, "Workspace name"),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid timezone."),
});

const withDateOrder = <T extends z.ZodObject>(schema: T, start: string, end: string, message: string) =>
  schema.superRefine((v, ctx) => {
    const rec = v as Record<string, unknown>;
    const a = rec[start] as string | null | undefined;
    const b = rec[end] as string | null | undefined;
    if (a && b && a > b) ctx.addIssue({ code: "custom", path: [end], message });
  });

export const projectSchema = withDateOrder(
  z.object({
    name: trimmed(1, 120, "Project name"),
    description: z.string().trim().max(2000).default(""),
    startDate: dateOnly,
    deadline: dateOnly,
    ownerId: optionalUuid,
  }),
  "startDate",
  "deadline",
  "The deadline must be on or after the start date.",
);

export const createProjectSchema = withDateOrder(
  z.object({
    name: trimmed(1, 120, "Project name"),
    description: z.string().trim().max(2000).default(""),
    startDate: dateOnly,
    deadline: dateOnly,
    ownerId: optionalUuid,
    memberIds: z.array(uuid).max(100).default([]),
    templateId: z.enum(["software", "assignment", "startup", "general"]).nullable().default(null),
    milestones: z.array(z.object({ name: trimmed(1, 120, "Milestone name"), targetDate: dateOnly })).max(30).default([]),
    tasks: z
      .array(
        z.object({
          key: z.string().min(1).max(40),
          title: trimmed(1, 200, "Task title"),
          priority: z.enum(PRIORITIES).default("medium"),
          startDate: dateOnly.default(null),
          dueDate: dateOnly.default(null),
          estimateHours: hours.default(null),
          dependsOn: z.array(z.string().max(40)).max(20).default([]),
        }),
      )
      .max(200)
      .default([]),
  }),
  "startDate",
  "deadline",
  "The deadline must be on or after the start date.",
);

export const createTaskSchema = withDateOrder(
  z.object({
    projectId: uuid,
    title: trimmed(1, 200, "Title"),
    description: z.string().max(10000).default(""),
    status: z.enum(TASK_STATUSES).default("todo"),
    priority: z.enum(PRIORITIES).default("medium"),
    assigneeId: optionalUuid.default(null),
    startDate: dateOnly.default(null),
    dueDate: dateOnly.default(null),
    estimateHours: hours.default(null),
    milestoneId: optionalUuid.default(null),
  }),
  "startDate",
  "dueDate",
  "The due date must be on or after the start date.",
);

export const updateTaskSchema = z
  .object({
    title: trimmed(1, 200, "Title"),
    description: z.string().max(10000),
    status: z.enum(TASK_STATUSES),
    priority: z.enum(PRIORITIES),
    assigneeId: optionalUuid,
    startDate: dateOnly,
    dueDate: dateOnly,
    estimateHours: hours.refine((v) => v === null || v > 0, "Estimates must be more than 0 hours."),
    actualHours: hours,
    milestoneId: optionalUuid,
    labels: z.array(z.string().trim().min(1).max(30)).max(10),
  })
  .partial()
  .strict();

export const commentSchema = z.object({ taskId: uuid, content: trimmed(1, 5000, "Comment") });

export const milestoneSchema = z.object({
  projectId: uuid,
  name: trimmed(1, 120, "Milestone name"),
  targetDate: dateOnly,
});

export const projectStatusSchema = z.enum(PROJECT_STATUSES);

export const inviteSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]),
  email: z.union([email, z.literal("")]).transform((v) => v || null),
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});

/** Turns a zod error into a field → message map plus a summary sentence. */
export function formatZodError(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: error.issues[0]?.message ?? "Check the highlighted fields.", fieldErrors };
}
