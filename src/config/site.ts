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
  },

  contact: {
    email: "getnerox@gmail.com",
    responseTime: "We usually reply within two working days.",
  },
} as const;

export const ownerReady = () => !!SITE.owner.name;
