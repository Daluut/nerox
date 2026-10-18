import { Plus } from "lucide-react";
import { SITE } from "@/config/site";

export function Faq({ paid }: { paid: boolean }) {
  const { currency, proMonthly, freeMemberLimit } = SITE.pricing;
  const items: [string, string][] = [
    ["Is Nerox really free?", `Yes. The Free plan includes projects, tasks, Pulse, What If? and Memory for teams of up to ${freeMemberLimit} people, with no card and no time limit.`],
    [
      "What does Pro add?",
      `Unlimited people in your workspace, full Nerox AI answers about your own projects, spreadsheet export and priority email support. It's ${currency}${proMonthly} per person a month, or less if you pay yearly.`,
    ],
    paid
      ? ["Can I cancel any time?", "Yes. Manage or cancel Pro from Settings in a couple of clicks. You keep Pro until the end of the period you've already paid for, then the workspace moves back to Free. Your projects stay put."]
      : ["Can I buy Pro yet?", "Not yet. Every feature is free during early access. Register your interest on the pricing page and we'll email you when Pro opens."],
    ["Who can see my projects?", "Only people you invite to your workspace, with the access their role allows. Viewers can read but not change anything."],
    ["Does Nerox AI read my data?", "The help guide answers on every plan without sending anything anywhere. When full AI answers are on, your question and a short summary of your active projects are sent to Anthropic to write the reply."],
    ["Do I need to install anything?", "No. Nerox runs in your browser on a computer, tablet or phone."],
  ];
  return (
    <div className="divide-y divide-white/10 border-y border-white/10">
      {items.map(([q, a]) => (
        <details key={q} className="mk-faq group">
          <summary className="flex items-center justify-between gap-6 py-5 text-[17px] font-medium transition-colors hover:text-[#c9bcff]">
            {q}
            <Plus aria-hidden className="mk-chev size-5 shrink-0 text-faint" />
          </summary>
          <p className="mk-faq-body max-w-[62ch] pb-6 text-[15px] leading-relaxed text-muted">{a}</p>
        </details>
      ))}
    </div>
  );
}
