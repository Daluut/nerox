import { redirect } from "next/navigation";
import { Logo } from "@/components/shell/logo";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

/** Shown only when the app is running without Supabase credentials. */
export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/overview");
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <Logo />
      <h1 className="mt-10 text-[22px] font-semibold">Nerox needs a database connection</h1>
      <p className="mt-3 text-muted">
        This deployment has no Supabase credentials, so sign-in and data storage are switched off. Nothing here is simulated.
      </p>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-[14px] text-muted">
        <li>Create a Supabase project and run the SQL in <code className="text-fg">supabase/migrations</code>.</li>
        <li>
          Copy <code className="text-fg">.env.example</code> to <code className="text-fg">.env.local</code> and fill in{" "}
          <code className="text-fg">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="text-fg">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </li>
        <li>Restart the server.</li>
      </ol>
      <p className="mt-6 text-[13px] text-faint">Full instructions are in README.md.</p>
    </main>
  );
}
