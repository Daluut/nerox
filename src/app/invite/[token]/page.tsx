import type { Metadata } from "next";
import { Logo } from "@/components/shell/logo";
import { requireUser } from "@/lib/data/context";
import { AcceptInvite } from "./accept";

export const metadata: Metadata = { title: "Join workspace" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { user } = await requireUser();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <Logo />
      <h1 className="mt-10 text-[22px] font-semibold">You&apos;ve been invited to a Nerox workspace</h1>
      <p className="mt-2 text-muted">
        Join as <span className="text-fg">{user.email}</span>. You&apos;ll see the workspace&apos;s projects and tasks once you accept.
      </p>
      <AcceptInvite token={token} />
    </main>
  );
}
