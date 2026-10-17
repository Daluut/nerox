"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { email as emailSchema, password as passwordSchema, signInSchema, signUpSchema } from "../validation";
import type { ActionResult } from "../data/types";
import { err, ok, parse } from "./util";

async function origin() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/** Only allow same-site relative redirects after sign-in. */
function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/overview";
}

export async function signIn(input: { email: string; password: string; next?: string }): Promise<ActionResult> {
  const v = parse(signInSchema, input);
  if (!v.ok) return v;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(v.data);
  if (error) {
    if (/confirm/i.test(error.message)) return err("Confirm your email address first — check your inbox for the link.");
    return err("That email and password don't match an account.");
  }
  redirect(safeNext(input.next));
}

export async function signUp(input: { name: string; email: string; password: string; next?: string }): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const v = parse(signUpSchema, input);
  // Invited people continue to their invitation; everyone else goes through onboarding.
  const next = input.next && safeNext(input.next).startsWith("/invite/") ? safeNext(input.next) : "/onboarding";
  if (!v.ok) return v;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: v.data.email,
    password: v.data.password,
    options: { data: { display_name: v.data.name }, emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    if (/already/i.test(error.message)) return err("An account with this email already exists. Sign in instead.");
    if (/rate/i.test(error.message)) return err("Too many attempts. Wait a minute and try again.");
    return err(error.message);
  }
  if (data.session) redirect(next);
  return ok({ needsConfirmation: true });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const v = parse(emailSchema, input.email);
  if (!v.ok) return v;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(v.data, {
    redirectTo: `${await origin()}/auth/callback?next=/reset-password`,
  });
  if (error && /rate/i.test(error.message)) return err("Too many attempts. Wait a minute and try again.");
  // Same response whether or not the account exists, so emails can't be enumerated.
  return ok(undefined);
}

export async function updatePassword(input: { password: string }): Promise<ActionResult> {
  const v = parse(passwordSchema, input.password);
  if (!v.ok) return v;
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: v.data });
  if (error) return err(/session/i.test(error.message) ? "Your reset link has expired. Request a new one." : error.message);
  redirect("/overview");
}
