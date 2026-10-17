/**
 * Everything about Nerox as a brand and its owner lives here.
 * Edit this one file to change the details shown on the home, About and Contact pages.
 *
 * Fields marked TODO still hold placeholders. The pages show a clear notice
 * instead of a broken link while a value is empty.
 */
export const SITE = {
  name: "Nerox",
  tagline: "Your projects, understood.",
  description:
    "Nerox is a simple project workspace for teams. Plan your work, see at a glance whether a project is on track, and fix problems before deadlines slip.",

  mission: "Help every team finish what they start, without the stress of guessing whether they're on track.",

  story: [
    "Most project tools are good at storing tasks and bad at telling you what they mean. You end up with long lists, a deadline, and a feeling that something is about to go wrong.",
    "Nerox was started to close that gap. It keeps your team's work in one tidy place, then reads it for you: what's late, what's holding other work up, who has too much on their plate, and whether the deadline still looks realistic.",
    "Every warning comes with the reason behind it, so you always know why Nerox is flagging something and what you can do about it.",
  ],

  values: [
    { title: "Simple first", body: "If it takes a manual to use, we haven't finished designing it." },
    { title: "Honest by default", body: "Nerox only says what your data supports. When it doesn't know, it tells you." },
    { title: "Built for real teams", body: "Students, start-ups and small companies, not just big enterprises." },
  ],

  owner: {
    name: "", // TODO: your full name
    role: "Founder", // TODO: your role or title
    bio: "", // TODO: one or two sentences about you
    linkedin: "", // TODO: https://www.linkedin.com/in/your-profile
  },

  contact: {
    email: "", // TODO: the address people should write to
    responseTime: "We usually reply within two working days.",
  },
} as const;

export const ownerReady = () => !!SITE.owner.name;
