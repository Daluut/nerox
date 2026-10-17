"use client";

import { Button } from "@/components/ui/primitives";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-6 py-20">
      <h1 className="text-[20px] font-semibold">This page couldn&apos;t load</h1>
      <p className="mt-2 text-muted">{error.message.startsWith("Couldn't load") ? error.message : "Nerox couldn't fetch the data for this page. Your work is safe; nothing was changed."}</p>
      <div className="mt-6 flex gap-2">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Button variant="ghost" onClick={() => (window.location.href = "/overview")}>
          Go to Overview
        </Button>
      </div>
    </div>
  );
}
