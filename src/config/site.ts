/**
 * Everything about Nerox as a brand and its owner lives here.
 * Edit this one file to change the details shown on the home, About and Contact pages.
 *
 * If a contact field is left empty, the pages show a "coming soon" notice
 * instead of a broken link.
 */
export const SITE = {
  name: "Nerox",
  tagline: "Your projects, understood.",
  description:
    "Nerox is a simple project workspace for teams. Plan your work, see at a glance whether a project is on track, and fix problems before deadlines slip.",

  mission: "Help every team finish what they start, without the stress of guessing whether they're on track.",

  story: [
    "Most project tools are good at storing tasks and bad at telling you what they mean. You end up with long lists, a deadline, and a feeling that something is about to go wrong.",
    "Nerox was founded by Daluut Warsame to close that gap. It keeps your team's work in one tidy place, then reads it for you: what's late, what's holding other work up, who has too much on their plate, and whether the deadline still looks realistic.",
    "Every warning comes with the reason behind it, so you always know why Nerox is flagging something and what you can do about it.",
  ],

  /** Shown on the home and About pages under "Why Nerox is different". */
  differentiators: [
    {
      title: "It tells you why, not just what",
      body: "Other tools show you a list. Pulse reads it for you and explains every warning with the evidence behind it, so you know exactly what to fix.",
    },
    {
      title: "Test a decision before you make it",
      body: "What If? shows the knock-on effects of a delay, a holiday or a deadline change across your whole plan, before anything changes for real.",
    },
    {
      title: "Gets smarter with every project",
      body: "Memory learns how long your team's work really takes, and helps you plan the next project more accurately.",
    },
    {
      title: "Help is always one click away",
      body: "Stuck? Ask Nerox AI how anything works or why a project is flagged, right where you are.",
    },
    {
      title: "Honest about what it doesn't know",
      body: "Facts, rule-based checks and forecasts are always labelled, and Nerox tells you when it doesn't have enough data instead of guessing.",
    },
    {
      title: "Simple enough for a student, strong enough for a team",
      body: "Templates, a guided tour, big clear buttons and your choice of colour themes, with real permissions and security underneath.",
    },
  ],

  values: [
    { title: "Simple first", body: "If it takes a manual to use, we haven't finished designing it." },
    { title: "Honest by default", body: "Nerox only says what your data supports. When it doesn't know, it tells you." },
    { title: "Built for real teams", body: "Students, start-ups and small companies, not just big enterprises." },
  ],

  owner: {
    name: "Daluut Warsame",
    role: "Founder & Owner",
    bio: "Daluut is the founder and owner of Nerox, and the mind behind every part of it, from the first idea to the product you're using today.",
    vision: [
      "Daluut had a vision: project software shouldn't just hold your work, it should understand it. He watched talented teams miss deadlines not because they lacked skill, but because nobody could see the problem coming until it was too late.",
      "So he set out to build something better. A workspace that's simple enough to pick up in minutes, smart enough to spot trouble early, and honest enough to always show its reasoning. That vision became Nerox.",
      "Driven, ambitious and relentlessly focused on the people who use it, Daluut is building Nerox to be the tool he always wished existed, and he's only just getting started.",
    ],
    linkedin: "https://www.linkedin.com/in/daluut-warsame/",
    quote:
      "Great things are never built alone. When a team can see clearly where it's going, it moves with confidence, and that's the moment ambition turns into achievement.",
  },

  instagram: { handle: "neroxhq", url: "https://www.instagram.com/neroxhq/" },

  /**
   * Plans and prices. Prices are per person in the workspace.
   * Payments only switch on once Stripe is configured (see docs/payments.md);
   * until then the Pro button registers interest by email and nothing is limited.
   */
  pricing: {
    currency: "£",
    proMonthly: 6,
    proYearly: 60, // per person per year: two months free
    freeMemberLimit: 5,
  },
  plans: [
    {
      id: "free",
      name: "Free",
      blurb: "Everything you need to run projects with a small team.",
      features: [
        "Unlimited projects and tasks",
        "Board, list and timeline views",
        "Pulse health checks",
        "What If? simulations",
        "Memory lessons and retrospectives",
        "Nerox AI help guide",
        "Up to 5 people in a workspace",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      blurb: "For growing teams that want room for everyone and smarter help.",
      features: [
        "Everything in Free",
        "Unlimited people in your workspace",
        "Nerox AI full answers about your own projects",
        "Export any project's tasks as a spreadsheet (CSV)",
        "Priority email support",
      ],
    },
  ],
  teams: {
    title: "Bringing Nerox to a larger organisation?",
    body: "Need invoices, a custom agreement or help rolling Nerox out across many teams? Email us and we'll work it out with you.",
  },

  contact: {
    email: "getnerox@gmail.com",
    responseTime: "We usually reply within two working days.",
  },
} as const;

export const ownerReady = () => !!SITE.owner.name;
