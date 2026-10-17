import Link from "next/link";
import { Logo } from "@/components/shell/logo";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-6 py-20">
      <Logo />
      <h1 className="mt-10 text-[20px] font-semibold">That page doesn&apos;t exist here</h1>
      <p className="mt-2 text-muted">It may have been deleted, or it belongs to a workspace you&apos;re not in. If you switched workspaces, switch back from the sidebar.</p>
      <Link href="/overview" className="mt-6 inline-block text-violet-strong hover:underline">
        Go to Overview
      </Link>
    </main>
  );
}
