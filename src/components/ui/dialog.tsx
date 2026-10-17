"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button, ErrorNote } from "./primitives";
import { cn } from "./cn";

/**
 * Modal and drawer built on the native <dialog> element, which gives focus
 * trapping, Escape-to-close and an inert background for free.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  variant = "modal",
  width = 480,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "modal" | "drawer";
  width?: number;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      className={cn(
        "m-0 max-h-none max-w-none bg-transparent p-0 text-fg backdrop:bg-black/55",
        variant === "drawer" ? "ml-auto h-dvh" : "mx-auto my-[8vh]",
      )}
      style={{ width: `min(${width}px, 100vw${variant === "modal" ? " - 24px" : ""})` }}
    >
      {open && (
        <div
          className={cn(
            "flex flex-col border-line-strong bg-panel shadow-[0_24px_64px_rgb(0_0_0/0.55)]",
            variant === "drawer" ? "anim-drawer h-full border-l" : "anim-pop max-h-[84vh] rounded-lg border",
          )}
        >
          {title !== undefined && (
            <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <h2 id={labelledBy} className="text-[15px] font-semibold">
                {title}
              </h2>
              <button onClick={onClose} aria-label="Close" className="rounded p-1 text-faint hover:bg-hover hover:text-fg">
                <X className="size-4" />
              </button>
            </header>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/** Confirmation for consequential actions. Optional typed confirmation for destructive ones. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  danger,
  requireText,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  requireText?: string;
  onConfirm: (typed: string) => Promise<string | null>; // returns an error message or null
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setTyped("");
      setError(null);
    }
  }, [open]);
  const blocked = requireText !== undefined && typed.trim() !== requireText;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            disabled={blocked}
            onClick={async () => {
              setBusy(true);
              const e = await onConfirm(typed);
              setBusy(false);
              if (e) setError(e);
              else onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 px-5 py-4 text-[13px] text-muted">
        <div>{body}</div>
        {requireText !== undefined && (
          <label className="flex flex-col gap-1.5">
            <span>
              Type <span className="font-semibold text-fg">{requireText}</span> to confirm.
            </span>
            <input className="field" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </label>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Dialog>
  );
}
