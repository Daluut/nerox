"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import { askNerox, type AiAnswer } from "@/lib/actions/ai";
import { useAppData } from "./app-context";
import { cn } from "@/components/ui/cn";

type Msg = { role: "user"; content: string } | { role: "assistant"; content: string; answer: AiAnswer };

const STARTERS = ["What does Pulse do?", "How do I invite my team?", "What is What If?", "Why is my project at risk?"];

/** Floating helper. Answers questions about Nerox and the person's projects. */
export function NeroxAI() {
  const data = useAppData();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: question }];
    setMsgs(next);
    setText("");
    setBusy(true);
    setError(null);
    const r = await askNerox(
      next.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      pathname,
    ).catch(() => null);
    setBusy(false);
    if (!r) return setError("Couldn't reach Nerox. Check your connection.");
    if (!r.ok) return setError(r.error);
    setMsgs((m) => [...m, { role: "assistant", content: r.data.text, answer: r.data }]);
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Ask Nerox AI"
        data-tour="ai"
        className="fixed bottom-5 right-5 z-40 flex h-14 items-center gap-2 rounded-full bg-violet px-5 text-[15px] font-semibold text-white shadow-[0_10px_30px_var(--violet-soft),0_4px_12px_rgb(0_0_0/0.2)] hover:bg-violet-strong"
      >
        {open ? <X className="size-5" /> : <Sparkles className="size-5" />}
        <span className="hidden sm:inline">{open ? "Close" : "Ask Nerox AI"}</span>
      </button>

      {open && (
        <section
          aria-label="Nerox AI"
          className="anim-pop fixed bottom-24 right-5 z-40 flex h-[min(600px,calc(100dvh-140px))] w-[min(400px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_24px_60px_rgb(0_0_0/0.3)]"
        >
          <header className="flex items-center gap-3 bg-violet px-5 py-4 text-white">
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/20">
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="text-[16px] font-bold">Nerox AI</p>
              <p className="text-[12px] text-white/80">{data.aiEnabled ? "Ask anything about Nerox or your projects" : "Answers from the Nerox help guide"}</p>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {!msgs.length && (
              <div>
                <p className="text-[15px]">Hi {data.displayName.split(" ")[0]}, stuck on something? Ask me, or try one of these:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {STARTERS.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="rounded-full border border-line-strong px-3 py-1.5 text-[13px] hover:border-violet hover:bg-violet-soft">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <p key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-violet px-4 py-2.5 text-[14px] text-white">
                  {m.content}
                </p>
              ) : (
                <div key={i} className="max-w-[92%]">
                  <div className="rounded-2xl rounded-bl-md bg-raised px-4 py-3 text-[14px] leading-relaxed">
                    {m.content.split(/\n{2,}/).map((p, j) => (
                      <p key={j} className={cn(j > 0 && "mt-2", "whitespace-pre-line")}>
                        {p}
                      </p>
                    ))}
                    {m.answer.links.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.answer.links.map((l) => (
                          <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg bg-violet-soft px-2.5 py-1 text-[13px] font-semibold text-violet hover:underline">
                            {l.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 px-1 text-[11px] text-faint">{m.answer.source === "ai" ? "AI-generated answer. It can make mistakes." : "From the Nerox help guide"}</p>
                </div>
              ),
            )}
            {busy && <p className="w-fit rounded-2xl bg-raised px-4 py-2.5 text-[14px] text-muted">Thinking…</p>}
            {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-[13px]">{error}</p>}
            <div ref={end} />
          </div>

          <form
            className="flex gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(text);
            }}
          >
            <input aria-label="Your question" className="field" placeholder="Type your question" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} autoFocus />
            <button type="submit" aria-label="Send" disabled={!text.trim() || busy} className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet text-white disabled:opacity-40">
              <Send className="size-4" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
