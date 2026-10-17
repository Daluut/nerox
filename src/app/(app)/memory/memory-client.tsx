"use client";

import { useState } from "react";
import { EyeOff, RotateCcw } from "lucide-react";
import { saveRetrospective, setInsightDismissed } from "@/lib/actions/memory";
import { Button, Field } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export function DismissButton({ insightKey, dismissed }: { insightKey: string; dismissed: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const r = await setInsightDismissed(insightKey, !dismissed);
        setBusy(false);
        if (!r.ok) toast.error(r.error);
        else toast.success(dismissed ? "Lesson restored." : "Lesson dismissed.");
      }}
    >
      {dismissed ? <RotateCcw className="size-4" /> : <EyeOff className="size-4" />}
      {dismissed ? "Restore" : "Not useful"}
    </Button>
  );
}

export function RetroNotes({ projectId, wentWell, toImprove, editable }: { projectId: string; wentWell: string; toImprove: string; editable: boolean }) {
  const toast = useToast();
  const [a, setA] = useState(wentWell);
  const [b, setB] = useState(toImprove);
  const [busy, setBusy] = useState(false);
  const changed = a !== wentWell || b !== toImprove;
  if (!editable && !wentWell && !toImprove) return null;
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <Field label="What went well" htmlFor={`ww-${projectId}`}>
        <textarea id={`ww-${projectId}`} className="field min-h-[90px]" value={a} onChange={(e) => setA(e.target.value)} disabled={!editable} maxLength={4000} placeholder="Wins worth repeating next time" />
      </Field>
      <Field label="What we'd do differently" htmlFor={`ti-${projectId}`}>
        <textarea id={`ti-${projectId}`} className="field min-h-[90px]" value={b} onChange={(e) => setB(e.target.value)} disabled={!editable} maxLength={4000} placeholder="Lessons for the next project" />
      </Field>
      {editable && (
        <Button
          size="sm"
          variant="primary"
          className="w-fit"
          disabled={!changed}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const r = await saveRetrospective(projectId, { wentWell: a, toImprove: b });
            setBusy(false);
            if (!r.ok) toast.error(r.error);
            else toast.success("Retrospective saved.");
          }}
        >
          Save notes
        </Button>
      )}
    </div>
  );
}
