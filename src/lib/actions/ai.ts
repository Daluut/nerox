"use server";

import { z } from "zod";
import { getAppContext } from "../data/context";
import { getEntitlements } from "../billing/server";
import { loadWorkspaceBundles } from "../data/queries";
import { isActiveProject } from "../data/views";
import { HEALTH_LABEL } from "../pulse/types";
import { helpAsText, searchHelp, type HelpArticle } from "../ai/help";
import type { ActionResult } from "../data/types";
import { err, ok, parse } from "./util";

/**
 * Nerox AI.
 *
 * With ANTHROPIC_API_KEY set, questions go to Claude with the help guide and a
 * short summary of the person's workspace. Without it (or if the provider fails),
 * the built-in help guide answers instead, so help always works. Answers say
 * which of the two produced them.
 */

const messagesSchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
  .min(1)
  .max(20);

export interface AiAnswer {
  source: "ai" | "guide" | "none";
  text: string;
  links: { href: string; label: string }[];
}

// Simple per-user limit so one person can't run up the provider bill.
const recent = new Map<string, number[]>();
const LIMIT = 20;
const WINDOW_MS = 10 * 60 * 1000;

function guideAnswer(question: string): AiAnswer {
  const hits = searchHelp(question);
  if (!hits.length) {
    return {
      source: "none",
      text: "I couldn't find that in the help guide. Try asking about tasks, Pulse, What If?, Memory, your team or settings, or email getnerox@gmail.com and a person will help.",
      links: [{ href: "/contact", label: "Contact us" }],
    };
  }
  const [best, ...more] = hits;
  return {
    source: "guide",
    text: best.answer + (more.length ? `\n\nRelated: ${more.map((m: HelpArticle) => m.question).join(" ")}` : ""),
    links: hits.filter((h) => h.link).map((h) => h.link!),
  };
}

export async function askNerox(messages: unknown, pathname: string): Promise<ActionResult<AiAnswer>> {
  const v = parse(messagesSchema, messages);
  if (!v.ok) return v;
  const ctx = await getAppContext();
  const last = v.data[v.data.length - 1];
  if (last.role !== "user") return err("Ask a question first.");

  const now = Date.now();
  const times = (recent.get(ctx.userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= LIMIT) return err("You've asked a lot of questions in a short time. Wait a few minutes and try again.");
  times.push(now);
  recent.set(ctx.userId, times);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return ok(guideAnswer(last.content));
  // Full AI answers are part of Pro once payments are switched on.
  if (!(await getEntitlements(ctx)).aiAnswers) return ok(guideAnswer(last.content));

  // A small, non-sensitive summary of the workspace so answers can be specific.
  const active = (await loadWorkspaceBundles(ctx)).filter(isActiveProject).slice(0, 10);
  const workspace = active
    .map((b) => {
      const a = b.assessment;
      const risks = a.risks.slice(0, 3).map((r) => r.title).join("; ");
      return `- ${b.project.name}: ${HEALTH_LABEL[a.status]}${a.score !== null ? ` (${a.score}/100)` : ""}, ${a.progress.percent}% done, ${a.counts.open} open tasks, deadline ${b.project.deadline ?? "none"}${risks ? `. Top risks: ${risks}` : ""}`;
    })
    .join("\n");

  const system = `You are Nerox AI, the friendly helper inside Nerox, a project management app.
Help people use Nerox and understand their projects. Keep answers short (under 150 words), warm and practical, in British English. Use plain sentences; avoid markdown headings.
Only state facts about the person's projects that appear in the workspace summary below; if something isn't there, say you can't see it. Never invent features. If you're unsure, say so and suggest emailing getnerox@gmail.com.

The person is ${ctx.displayName} (${ctx.role}) in the workspace "${ctx.workspace.name}". Today is ${ctx.today}. They are on the page ${pathname.slice(0, 100)}.

Workspace summary:
${workspace || "(no active projects)"}

Nerox help guide:
${helpAsText()}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.NEROX_AI_MODEL || "claude-haiku-5-5",
        max_tokens: 500,
        system,
        messages: v.data,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`AI provider returned ${res.status}`);
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = body.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
    if (!text) throw new Error("Empty AI response");
    return ok({ source: "ai", text, links: searchHelp(last.content, 2).filter((h) => h.link).map((h) => h.link!) });
  } catch (e) {
    console.error("[nerox] AI request failed:", e instanceof Error ? e.message : e);
    const fallback = guideAnswer(last.content);
    return ok({ ...fallback, text: `Nerox AI is unavailable right now, so here's the help guide instead.\n\n${fallback.text}` });
  }
}
