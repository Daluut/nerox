"use client";

import Link from "next/link";
import { useState } from "react";
import { acceptInvitation } from "@/lib/actions/workspace";
import { Button, ErrorNote } from "@/components/ui/primitives";

export function AcceptInvite({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-8 flex flex-col gap-3">
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2">
        <Button
          variant="primary"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const r = await acceptInvitation(token);
            setBusy(false);
            if (r && !r.ok) setError(r.error);
          }}
        >
          Accept and join
        </Button>
        <Link href="/overview" className="inline-flex h-9 items-center px-3 text-sm text-muted hover:text-fg">
          Not now
        </Link>
      </div>
    </div>
  );
}
