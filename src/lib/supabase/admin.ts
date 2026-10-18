import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * A Supabase client with the service role key. It bypasses row-level security,
 * so it is used in exactly two places that have no signed-in user and must write
 * billing state: the verified Stripe webhook, and keeping seat counts in sync.
 * Never import this from client code; `server-only` makes that a build error.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
