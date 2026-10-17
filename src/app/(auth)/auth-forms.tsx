"use client";

import Link from "next/link";
import { useState } from "react";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/lib/actions/auth";
import { Button, ErrorNote, Field } from "@/components/ui/primitives";

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  async function run(fn: () => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const r = await fn();
      if (r && !r.ok) {
        setError(r.error ?? "Something went wrong.");
        setFieldErrors(r.fieldErrors ?? {});
      }
      return r;
    } catch (e) {
      // redirect() from a server action throws a special error the router handles.
      if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
      setError("Couldn't reach Nerox. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, fieldErrors, run };
}

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const { busy, error, fieldErrors, run } = useSubmit();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() => signIn({ email: String(f.get("email")), password: String(f.get("password")), next }));
      }}
    >
      <div className="mb-2">
        <h1 className="text-[22px] font-semibold">Sign in</h1>
        <p className="mt-1 text-muted">Welcome back.</p>
      </div>
      {notice && <p className="rounded-md border border-line-strong bg-raised px-3 py-2 text-[13px]">{notice}</p>}
      <Field label="Email" htmlFor="email" error={fieldErrors.email}>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" aria-invalid={!!fieldErrors.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={fieldErrors.password}>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </Field>
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="text-[13px] text-muted hover:text-fg">
          Forgot your password?
        </Link>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" variant="primary" loading={busy}>
        Sign in
      </Button>
      <p className="text-center text-[13px] text-muted">
        New to Nerox?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="text-violet-strong hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const { busy, error, fieldErrors, run } = useSubmit();
  const [sentTo, setSentTo] = useState<string | null>(null);
  if (sentTo) {
    return (
      <div>
        <h1 className="text-[22px] font-semibold">Check your email</h1>
        <p className="mt-2 text-muted">
          We sent a confirmation link to <span className="text-fg">{sentTo}</span>. Open it to finish creating your account.
        </p>
        <Link href="/login" className="mt-6 inline-block text-[13px] text-violet-strong hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const email = String(f.get("email"));
        run(async () => {
          const r = await signUp({ name: String(f.get("name")), email, password: String(f.get("password")), next });
          if (r.ok && r.data.needsConfirmation) setSentTo(email);
          return r;
        });
      }}
    >
      <div className="mb-2">
        <h1 className="text-[22px] font-semibold">Create your account</h1>
        <p className="mt-1 text-muted">Free while Nerox is in early access.</p>
      </div>
      <Field label="Your name" htmlFor="name" error={fieldErrors.name}>
        <input id="name" name="name" autoComplete="name" required maxLength={80} className="field" aria-invalid={!!fieldErrors.name} />
      </Field>
      <Field label="Email" htmlFor="email" error={fieldErrors.email}>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" aria-invalid={!!fieldErrors.email} />
      </Field>
      <Field label="Password" htmlFor="password" error={fieldErrors.password} hint="At least 8 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="field" aria-invalid={!!fieldErrors.password} />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" variant="primary" loading={busy}>
        Create account
      </Button>
      <p className="text-center text-[13px] text-muted">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="text-violet-strong hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { busy, error, fieldErrors, run } = useSubmit();
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <div>
        <h1 className="text-[22px] font-semibold">Check your email</h1>
        <p className="mt-2 text-muted">If an account exists for that address, a link to reset your password is on its way.</p>
        <Link href="/login" className="mt-6 inline-block text-[13px] text-violet-strong hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const email = String(new FormData(e.currentTarget).get("email"));
        run(async () => {
          const r = await requestPasswordReset({ email });
          if (r.ok) setSent(true);
          return r;
        });
      }}
    >
      <div className="mb-2">
        <h1 className="text-[22px] font-semibold">Reset your password</h1>
        <p className="mt-1 text-muted">We&apos;ll email you a link to choose a new one.</p>
      </div>
      <Field label="Email" htmlFor="email" error={fieldErrors._}>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" variant="primary" loading={busy}>
        Send reset link
      </Button>
      <Link href="/login" className="text-center text-[13px] text-muted hover:text-fg">
        Back to sign in
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const { busy, error, run } = useSubmit();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const password = String(f.get("password"));
        if (password !== String(f.get("confirm"))) {
          run(async () => ({ ok: false, error: "The passwords don't match." }));
          return;
        }
        run(() => updatePassword({ password }));
      }}
    >
      <div className="mb-2">
        <h1 className="text-[22px] font-semibold">Choose a new password</h1>
      </div>
      <Field label="New password" htmlFor="password" hint="At least 8 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="field" />
      </Field>
      <Field label="Confirm password" htmlFor="confirm">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} className="field" />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" variant="primary" loading={busy}>
        Update password
      </Button>
    </form>
  );
}
