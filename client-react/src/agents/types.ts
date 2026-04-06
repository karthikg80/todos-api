export type AgentId = "orla" | "finn" | "mira" | "echo" | "sol" | "kodo";

export type AvatarMode = "idle" | "thinking" | "speaking";

export interface AgentColors {
  stroke: string;
  bg: string;
  textDark: string;
  traitBg: string;
}

export interface AgentVoice {
  tone: "measured" | "blunt" | "warm" | "rapid" | "reflective" | "terse";
  avgWordsPerSentence: number;
  openers: string[];
  closers: string[];
  thinkingLines: string[];
  emptyStateLines: string[];
  errorLines: string[];
}

export interface AgentProfile {
  id: AgentId;
  name: string;
  role: string;
  traits: [string, string, string];
  quote: string;
  superpower: string;
  quirk: string;
  bestCalledWhen: string;
  colors: AgentColors;
  voice: AgentVoice;
  avatarSeed: number;
}
