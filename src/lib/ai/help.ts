/**
 * Nerox help guide. Used two ways:
 *  - as the knowledge Nerox AI is given when an AI provider is configured, and
 *  - on its own, searched by keyword, when it isn't (so help always works).
 */
export interface HelpArticle {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
  link?: { href: string; label: string };
}

export const HELP: HelpArticle[] = [
  {
    id: "start",
    question: "How do I get started?",
    keywords: ["start", "begin", "new", "first", "setup", "how"],
    answer:
      "Create a project (Projects, then New project). Pick a template to get starting tasks, or start blank. Give tasks an owner and a due date, then link tasks that depend on each other. Pulse starts checking the project once it has three or more tasks.",
    link: { href: "/projects/new", label: "Create a project" },
  },
  {
    id: "task",
    question: "How do I add a task?",
    keywords: ["add", "create", "task", "new task", "todo"],
    answer:
      "Press the purple New task button at the top of any page. Only a title is required. You can also add tasks from a project's board (the + on each column), from the List tab, or from My Tasks.",
  },
  {
    id: "edit-task",
    question: "How do I change a task's due date, owner or status?",
    keywords: ["edit", "change", "due", "date", "owner", "assign", "status", "priority", "complete", "done"],
    answer:
      "Click a task anywhere to open its panel. Every field there saves as soon as you change it: status, priority, owner, start and due dates, estimate, actual effort, milestone and labels. Use Mark complete when it's done. On the board you can also drag cards between columns.",
  },
  {
    id: "dependency",
    question: "What are dependencies?",
    keywords: ["dependency", "dependencies", "depends", "wait", "waits", "blocks", "blocked", "link", "order"],
    answer:
      "A dependency says one task can't finish until another is done. For example, Testing waits on Building. Open a task and use \"+ Waits on\" or \"+ Blocks\". Nerox won't let you create a loop. Dependencies let Pulse spot when a late task is holding up others, and let What If? work out knock-on effects.",
  },
  {
    id: "pulse",
    question: "What is Pulse?",
    keywords: ["pulse", "health", "score", "risk", "risks", "critical", "at risk", "healthy"],
    answer:
      "Pulse is Nerox's health check. It reads each project's tasks, dates, links and owners and gives a score from 0 to 100: 80+ is healthy, 60–79 needs attention, 40–59 is at risk and below 40 is critical. It also lists specific problems (risks) with the evidence behind each one and a suggested next step. It's calculated by fixed rules, not guesswork, and it tells you what it couldn't measure.",
    link: { href: "/pulse", label: "Open Pulse" },
  },
  {
    id: "weighting",
    question: "What does Pulse weighting in Settings do?",
    keywords: ["weight", "weighting", "weights", "settings", "factor", "factors", "slider"],
    answer:
      "The health score is made from seven checks (factors): pace, overdue work, deadline feasibility, dependencies, workload balance, stalled tasks and milestones. Weighting decides how much each check counts towards the final score. Raise a slider if that thing matters a lot to your team, lower it (even to 0) if it doesn't. It only changes how the score is added up, never the risks Pulse reports. Only owners and admins can change it, and Reset to defaults puts it back.",
    link: { href: "/settings", label: "Open Settings" },
  },
  {
    id: "whatif",
    question: "What is What If?",
    keywords: ["what if", "whatif", "simulate", "simulation", "scenario", "delay", "late", "away", "holiday", "reassign"],
    answer:
      "What If? lets you test a change before you make it. Choose a project, then add a change like \"this task runs 3 days late\", \"Sam is away next week\" or \"the deadline moves\". Nerox shows which tasks would move, the new finish date, milestones affected, workload and the health score. Nothing changes until you press Apply and confirm. You can save scenarios to look at later.",
    link: { href: "/what-if", label: "Open What If?" },
  },
  {
    id: "memory",
    question: "What is Memory?",
    keywords: ["memory", "learn", "lesson", "lessons", "estimate", "estimates", "retrospective", "retro", "history", "past"],
    answer:
      "Memory learns from finished work. When tasks are completed it notes whether they were on time and, if you record actual effort, how long they really took compared with the estimate. Once it has enough evidence (at least 5 tasks of the same kind from 2+ projects) it shows lessons like \"Testing usually takes 40% longer than estimated\", and suggests better estimates when you plan a new project. Each project also gets a retrospective with the facts and your team's notes.",
    link: { href: "/memory", label: "Open Memory" },
  },
  {
    id: "invite",
    question: "How do I invite my team?",
    keywords: ["invite", "team", "member", "members", "join", "add people", "share", "collaborate"],
    answer:
      "Go to Team and press Create invite link. Choose their role (Member can edit, Viewer can only look) and optionally lock it to their email. Send them the link; it works once and expires after 7 days. Only owners and admins can invite.",
    link: { href: "/team", label: "Open Team" },
  },
  {
    id: "roles",
    question: "What can each role do?",
    keywords: ["role", "roles", "owner", "admin", "viewer", "permission", "permissions", "access"],
    answer:
      "Owner: everything, including deleting the workspace. Admin: manages people, invitations and settings. Member: creates and edits projects, tasks and comments. Viewer: can look but not change anything.",
  },
  {
    id: "milestone",
    question: "How do milestones work?",
    keywords: ["milestone", "milestones", "checkpoint", "goal"],
    answer:
      "Milestones are key checkpoints in a project, like \"Draft complete\". Add them on a project's Overview tab, then link tasks to a milestone from the task panel. Pulse warns you when a milestone is close and most of its linked work is still open.",
  },
  {
    id: "board",
    question: "How does the board work?",
    keywords: ["board", "kanban", "column", "columns", "drag", "move"],
    answer:
      "Each project has a board with five columns: Backlog, To Do, In Progress, In Review and Done. Drag a card to change its status, or use the small status circle on the card. Changes save instantly.",
  },
  {
    id: "timeline",
    question: "What does the timeline show?",
    keywords: ["timeline", "gantt", "calendar", "schedule", "dates"],
    answer:
      "The Timeline tab draws each task from its start date to its due date, with lines between tasks that depend on each other, today's date and the project deadline. Red links mean a task is due before the task it depends on. Tasks need a due date to appear.",
  },
  {
    id: "theme",
    question: "How do I change the colours?",
    keywords: ["theme", "colour", "color", "dark", "light", "nerox theme", "mode"],
    answer: "Use the Light, Dark and Nerox buttons at the bottom of the sidebar, or the Colours section in Settings. Your choice is remembered on this device.",
  },
  {
    id: "tutorial",
    question: "Can I see the tutorial again?",
    keywords: ["tutorial", "tour", "guide", "help", "walkthrough"],
    answer: "Yes. Press the question-mark button at the top of the page, or choose \"Show the tutorial\" from your account menu.",
  },
  {
    id: "archive",
    question: "How do I archive or delete a project?",
    keywords: ["archive", "delete", "remove", "complete project", "finish project"],
    answer:
      "Open the project and use the ••• menu at the top right. Mark as completed moves it to Completed. Archive hides it but keeps everything. Delete removes it permanently and asks you to type the name to confirm.",
  },
  {
    id: "notifications",
    question: "What notifications will I get?",
    keywords: ["notification", "notifications", "bell", "alert", "alerts"],
    answer: "The bell shows when you're assigned a task, when a task you're on is reassigned, when someone comments on your task, and when a milestone in your project is completed.",
  },
  {
    id: "search",
    question: "How do I find something?",
    keywords: ["search", "find", "look", "where"],
    answer: "Press Ctrl+K (⌘K on a Mac) or the Search box at the top to search projects, tasks, milestones and people.",
  },
  {
    id: "pricing",
    question: "How much does Nerox cost?",
    keywords: ["price", "pricing", "cost", "pay", "paid", "plan", "plans", "upgrade", "pro", "business", "enterprise", "free"],
    answer:
      "Nerox is free while it's in early access, including Pulse, What If? and Memory. Paid plans for growing teams and large companies are on the way; see the Pricing page for what's included and how to register interest.",
    link: { href: "/pricing", label: "See pricing" },
  },
  {
    id: "contact",
    question: "How do I contact Nerox?",
    keywords: ["contact", "email", "support", "help", "instagram", "linkedin", "founder"],
    answer: "Email getnerox@gmail.com, follow @neroxhq on Instagram for updates, or connect with the founder, Daluut Warsame, on LinkedIn. All links are on the Contact page.",
    link: { href: "/contact", label: "Contact page" },
  },
  {
    id: "password",
    question: "I forgot my password",
    keywords: ["password", "forgot", "reset", "login", "sign in", "log in"],
    answer: "On the sign-in page, choose \"Forgot your password?\" and enter your email. You'll get a link to set a new one.",
  },
];

const STOP = new Set(["what", "how", "does", "do", "is", "the", "can", "my", "i", "a", "an", "to", "of", "in", "it", "and", "or", "for", "on", "me", "we", "our", "this", "that", "with", "when", "why", "who", "where"]);
const words = (s: string) => [
  ...new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w)),
  ),
];

/** Keyword search over the help guide. Returns the best matches, best first. */
export function searchHelp(query: string, limit = 3): HelpArticle[] {
  const q = query.toLowerCase();
  const qw = new Set(words(query));
  return HELP.map((a) => {
    let score = 0;
    for (const k of a.keywords) {
      if (k.includes(" ") ? q.includes(k) : qw.has(k)) score += k.includes(" ") ? 3 : 2;
      else if ([...qw].some((w) => w.length > 3 && (k.startsWith(w) || w.startsWith(k)))) score += 1;
    }
    for (const w of words(a.question)) if (qw.has(w) && w.length > 3) score += 1;
    return { a, score };
  })
    .filter((x) => x.score > 1)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((x) => x.a);
}

export const helpAsText = () => HELP.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n");
