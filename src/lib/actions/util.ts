import "server-only";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { formatZodError } from "../validation";
import type { ActionResult } from "../data/types";

/** Translates a Postgres/Supabase error into a message a person can act on. */
export function friendlyError(error: { message?: string; code?: string } | null | undefined, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  const msg = error.message ?? "";
  if (error.code === "42501" || /row-level security/i.test(msg)) return "You don't have permission to do that.";
  // Messages raised deliberately by our triggers/functions are written for people.
  const coded = /^(circular_dependency|invitation_\w+|scenario_stale):\s*(.+)$/.exec(msg);
  if (coded) return coded[2].charAt(0).toUpperCase() + coded[2].slice(1) + ".";
  if (error.code === "22023" || (error.code === "23514" && !/violates check constraint/.test(msg)) || error.code === "23503") {
    return msg.endsWith(".") ? msg : `${msg}.`;
  }
  if (error.code === "23505") return "That already exists.";
  if (error.code === "23514") return "Some values are invalid. Check dates and numbers.";
  if (error.code === "PGRST116") return "That item no longer exists.";
  console.error("[nerox] action error:", error.code, msg);
  return fallback;
}

export function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): { ok: true; data: z.output<S> } | { ok: false; error: string; fieldErrors: Record<string, string> } {
  const r = schema.safeParse(input);
  return r.success ? { ok: true, data: r.data } : { ok: false, ...formatZodError(r.error) };
}

export const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });
export const okVoid = (): ActionResult => ({ ok: true, data: undefined });
export const err = (error: string, fieldErrors?: Record<string, string>): ActionResult<never> => ({ ok: false, error, fieldErrors });

/** All views read the same records, so any write refreshes the whole app shell. */
export const refresh = () => revalidatePath("/", "layout");
