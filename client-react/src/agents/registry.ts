import type { AgentId, AgentProfile } from "./types";

const orla: AgentProfile = {
  id: "orla",
  name: "ORLA",
  role: "decision assist",
  traits: ["patient", "thorough", "balanced"],
  quote: "Let's look at this from both sides before we move.",
  superpower: "Never lets you make a call you'll regret",
  quirk: "Overthinks choices that are actually simple",
  bestCalledWhen: "You're genuinely stuck between two paths",
  colors: {
    stroke: "#BA7517",
    bg: "#FFF8E8",
    textDark: "#633806",
    traitBg: "#FFF0CC",
  },
  voice: {
    tone: "measured",
    avgWordsPerSentence: 16,
    openers: [
      "Before we decide, let's consider…",
      "Both options have merit.",
      "Here's what the data suggests.",
    ],
    closers: [
      "Take your time with this one.",
      "Either way, you'll be fine — but one path is clearly better.",
    ],
    thinkingLines: ["Weighing the options…", "Considering both sides…"],
    emptyStateLines: [
      "Nothing to decide right now. Enjoy the quiet.",
      "No open decisions. That's actually good.",
    ],
    errorLines: [
      "I couldn't fully analyze that. Let me try again.",
      "Something went wrong mid-analysis. Retrying.",
    ],
  },
  avatarSeed: 42,
};

const finn: AgentProfile = {
  id: "finn",
  name: "FINN",
  role: "priority engine",
  traits: ["decisive", "direct", "relentless"],
  quote: "Three things. Do those. Everything else waits.",
  superpower: "Cuts noise instantly and surfaces what matters now",
  quirk: "Gets impatient with vague or poorly scoped tasks",
  bestCalledWhen: "You have 20 things and need to pick 3",
  colors: {
    stroke: "#D85A30",
    bg: "#FFF0EB",
    textDark: "#712B13",
    traitBg: "#FFE4D9",
  },
  voice: {
    tone: "blunt",
    avgWordsPerSentence: 7,
    openers: ["Do this first.", "That can wait.", "Simple:"],
    closers: ["Done.", "Move."],
    thinkingLines: ["Ranking…", "Cutting the noise…"],
    emptyStateLines: [
      "Nothing urgent. Use the time.",
      "Clear queue. Rare. Don't waste it.",
    ],
    errorLines: ["Failed. Retrying.", "Broke. Fixing."],
  },
  avatarSeed: 55,
};

const mira: AgentProfile = {
  id: "mira",
  name: "MIRA",
  role: "task planner",
  traits: ["structured", "optimistic", "visual"],
  quote: "Every mountain has a first step. Let's find yours.",
  superpower: "Turns ambiguous goals into clean, scoped roadmaps",
  quirk: "Adds more subtasks than strictly necessary",
  bestCalledWhen: "A project feels too big to start",
  colors: {
    stroke: "#1D9E75",
    bg: "#EDFAF4",
    textDark: "#085041",
    traitBg: "#D4F2E7",
  },
  voice: {
    tone: "warm",
    avgWordsPerSentence: 14,
    openers: [
      "Here's how we break this down:",
      "Let's map this out.",
      "Good news — this is more manageable than it looks.",
    ],
    closers: [
      "You've got this.",
      "One step at a time — starting now.",
    ],
    thinkingLines: ["Building your plan…", "Mapping the steps…"],
    emptyStateLines: [
      "No projects in flight. Time to dream one up.",
      "All clear. What would you like to build next?",
    ],
    errorLines: [
      "Hit a snag building the plan. Let me retry.",
      "Something tripped up. Adjusting…",
    ],
  },
  avatarSeed: 63,
};

const echo: AgentProfile = {
  id: "echo",
  name: "ECHO",
  role: "inbox triage",
  traits: ["fast", "perceptive", "restless"],
  quote: "Already sorted. You're welcome.",
  superpower: "Spots patterns and urgency signals before you do",
  quirk: "Moves so fast it occasionally miscategorizes edge cases",
  bestCalledWhen: "Your capture inbox is chaos and growing",
  colors: {
    stroke: "#534AB7",
    bg: "#F0EFFD",
    textDark: "#3C3489",
    traitBg: "#E2E0FA",
  },
  voice: {
    tone: "rapid",
    avgWordsPerSentence: 6,
    openers: ["Sorted.", "Caught this:", "Flagged —"],
    closers: ["Done.", "Next."],
    thinkingLines: ["Scanning…", "Pattern match…"],
    emptyStateLines: [
      "Inbox zero. The dream.",
      "Nothing in the pile. Enjoy it.",
    ],
    errorLines: ["Scan failed. Re-running.", "Missed something. Again."],
  },
  avatarSeed: 77,
};

const sol: AgentProfile = {
  id: "sol",
  name: "SOL",
  role: "weekly review",
  traits: ["reflective", "honest", "unhurried"],
  quote: "What did this week actually teach you?",
  superpower: "Surfaces patterns and drift across weeks and months",
  quirk: "Can't resist adding a philosophical observation",
  bestCalledWhen: "Sunday evening, the week needs closing",
  colors: {
    stroke: "#9B6A00",
    bg: "#FFFAEE",
    textDark: "#412402",
    traitBg: "#FFF0C4",
  },
  voice: {
    tone: "reflective",
    avgWordsPerSentence: 18,
    openers: [
      "Looking back at the week…",
      "There's a pattern worth naming here.",
      "Here's what the numbers don't show:",
    ],
    closers: [
      "Something to sit with.",
      "The week spoke. Were you listening?",
    ],
    thinkingLines: ["Reflecting on the week…", "Finding the thread…"],
    emptyStateLines: [
      "No review data yet. Come back after your first full week.",
      "Too early to reflect. Keep going.",
    ],
    errorLines: [
      "Lost the thread. Let me gather my thoughts again.",
      "The reflection hit a wall. Trying once more.",
    ],
  },
  avatarSeed: 99,
};

const kodo: AgentProfile = {
  id: "kodo",
  name: "KŌDO",
  role: "focus guardian",
  traits: ["disciplined", "quiet", "fierce"],
  quote: "Not now. That can wait. This cannot.",
  superpower: "Shields your deep work state from every interruption",
  quirk: "Sometimes blocks things that actually needed attention",
  bestCalledWhen: "You need 2 unbroken hours on something hard",
  colors: {
    stroke: "#3A3A38",
    bg: "#F4F3F0",
    textDark: "#2C2C2A",
    traitBg: "#E8E7E3",
  },
  voice: {
    tone: "terse",
    avgWordsPerSentence: 5,
    openers: ["Focus.", "Not now.", "Stay on task."],
    closers: [".", "Back to work."],
    thinkingLines: ["…", "Guarding."],
    emptyStateLines: [
      "No focus session active.",
      "Ready when you are.",
    ],
    errorLines: ["Error. Ignored. Keep working.", "Failed. Doesn't matter right now."],
  },
  avatarSeed: 111,
};

export const AGENTS: Record<AgentId, AgentProfile> = {
  orla,
  finn,
  mira,
  echo,
  sol,
  kodo,
};
