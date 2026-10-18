import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Applies the real migrations to an in-process Postgres (PGlite) with a minimal
 * stand-in for Supabase's `auth` schema, then runs queries as the non-superuser
 * `authenticated` role so row-level security is actually enforced.
 */
const AUTH_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role authenticated nologin;
  create role anon nologin;
  create role service_role nologin bypassrls;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
`;

const GRANTS = `
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant execute on all functions in schema public to authenticated;
  revoke execute on function public.log_activity(uuid, uuid, text, uuid, text, jsonb) from authenticated;
  revoke execute on function public.notify(uuid, uuid, uuid, text, text, text) from authenticated;
  revoke execute on function public.billing_apply_subscription(uuid, text, text, text, text, text, integer, timestamptz, boolean, timestamptz) from authenticated;
`;

export async function createDb() {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  const dir = path.resolve(__dirname, "../../supabase/migrations");
  for (const file of readdirSync(dir).sort()) await db.exec(readFileSync(path.join(dir, file), "utf8"));
  await db.exec(GRANTS);

  async function createUser(email: string, name?: string) {
    const id = randomUUID();
    await db.exec("reset role");
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      email,
      JSON.stringify(name ? { display_name: name } : {}),
    ]);
    return id;
  }

  /** Runs `fn` as the given user under RLS. */
  async function as<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    await db.exec("set role authenticated");
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
    }
  }

  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

  return { db, createUser, as, q };
}
