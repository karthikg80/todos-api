import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import type { ProjectStatus, TodoStatus, TodoPriority } from "@prisma/client";

const DEMO_EMAIL = "demo@todos.local";
const DEMO_PASSWORD = "demodemo";
const SALT_ROUNDS = 10;
const TARGET_PROJECTS = 30;
const TARGET_TODOS = 1000;
const ONE_DAY_MS = 86_400_000;

// mulberry32: tiny seedable PRNG so re-running the seed is deterministic.
// Override with SEED_RANDOM=<int> to get a different draw.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROJECT_NAME_TEMPLATES = [
  "Website Redesign",
  "Quarterly Plan",
  "Apartment Move",
  "Reading List",
  "Side Project",
  "Conference Talk",
  "Home Renovation",
  "Trip Planning",
  "Fitness Goals",
  "Learn Spanish",
  "Open Source",
  "Hiring Pipeline",
  "Inbox Zero",
  "Annual Review",
  "Tax Prep",
  "Holiday Cards",
  "Garden Project",
  "Birthday Party",
  "Book Club",
  "Volunteering",
  "Investment Plan",
  "Career Goals",
  "Wedding Plan",
  "Medical Checkups",
  "Budget Cleanup",
  "Recipe Collection",
  "Art Studio",
  "Photo Backup",
  "Home Inventory",
  "Workshop Build",
];

const TODO_TITLE_TEMPLATES = [
  "Draft outline for proposal",
  "Review feedback from team",
  "Schedule kickoff meeting",
  "Send follow-up email",
  "Update project tracker",
  "Triage support backlog",
  "Pay invoice",
  "Renew subscription",
  "Refactor settings module",
  "Investigate flaky test",
  "Write release notes",
  "Submit expense report",
  "Confirm reservation",
  "Pick up package",
  "Replace air filter",
  "Order birthday gift",
  "Book annual physical",
  "Sync with mentor",
  "Read research paper",
  "Polish demo script",
  "Reply to recruiter",
  "Wrap up retro action items",
  "Plan sprint capacity",
  "Audit dependencies",
  "Reconcile bank statement",
  "Migrate notes to new tool",
  "Calibrate monitor",
  "Inventory pantry",
  "Cancel duplicate trial",
  "Backup laptop",
  "Refresh resume",
  "Stretch routine",
  "Walk the dog",
  "Donate clothes",
  "Compost run",
  "Charity donation",
  "Practice piano",
  "Sketch design comp",
  "Review pull request",
  "Catch up on Slack DMs",
];

const SUBTASK_TITLES = [
  "Outline first pass",
  "Sanity check assumptions",
  "Get sign-off",
  "Send for review",
  "Document decisions",
  "Add to changelog",
  "Update wiki",
  "File issue",
];

const TODO_STATUS_DISTRIBUTION: Array<[TodoStatus, number]> = [
  ["inbox", 0.15],
  ["next", 0.25],
  ["in_progress", 0.15],
  ["waiting", 0.1],
  ["scheduled", 0.15],
  ["someday", 0.05],
  ["done", 0.1],
  ["cancelled", 0.05],
];

const TODO_PRIORITY_DISTRIBUTION: Array<[TodoPriority, number]> = [
  ["low", 0.3],
  ["medium", 0.4],
  ["high", 0.25],
  ["urgent", 0.05],
];

const PROJECT_STATUS_POOL: ProjectStatus[] = [
  "active",
  "active",
  "active",
  "active",
  "active",
  "on_hold",
  "completed",
  "archived",
];

function pickWeighted<T>(rand: () => number, buckets: Array<[T, number]>): T {
  let roll = rand();
  for (const [value, weight] of buckets) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return buckets[buckets.length - 1][0];
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set; cannot seed");
  }
  const seedSeed = Number.parseInt(process.env.SEED_RANDOM ?? "", 10) || 42;
  const rand = mulberry32(seedSeed);
  const pick = <T>(arr: readonly T[]): T =>
    arr[Math.floor(rand() * arr.length)];
  const intInclusive = (min: number, max: number): number =>
    Math.floor(rand() * (max - min + 1)) + min;

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    // Wipe the seed user — FK cascades handle their projects/todos/subtasks/headings.
    const wiped = await prisma.user.deleteMany({
      where: { email: DEMO_EMAIL },
    });
    if (wiped.count > 0) {
      console.log(`Removed ${wiped.count} existing seed user(s).`);
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);
    const now = new Date();
    const user = await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        password: passwordHash,
        name: "Demo User",
        isVerified: true,
        onboardingStep: 100,
        onboardingCompletedAt: now,
      },
    });

    const projects = Array.from({ length: TARGET_PROJECTS }, (_, i) => {
      const status = pick(PROJECT_STATUS_POOL);
      const archived = status === "archived";
      // Pareto-ish weight: squaring a uniform skews mass toward zero, so a
      // few projects pull most of the todos.
      const weight = Math.pow(rand(), 2);
      return {
        id: randomUUID(),
        name: `${pick(PROJECT_NAME_TEMPLATES)} ${i + 1}`,
        status,
        archived,
        archivedAt: archived
          ? new Date(now.getTime() - intInclusive(1, 90) * ONE_DAY_MS)
          : null,
        priority:
          rand() < 0.3 ? pickWeighted(rand, TODO_PRIORITY_DISTRIBUTION) : null,
        weight,
      };
    });

    await prisma.project.createMany({
      data: projects.map((p) => ({
        id: p.id,
        userId: user.id,
        name: p.name,
        status: p.status,
        archived: p.archived,
        archivedAt: p.archivedAt,
        priority: p.priority,
      })),
    });

    const totalWeight = projects.reduce((s, p) => s + p.weight, 0);
    const pickProject = (): (typeof projects)[number] => {
      let r = rand() * totalWeight;
      for (const p of projects) {
        r -= p.weight;
        if (r <= 0) return p;
      }
      return projects[projects.length - 1];
    };

    const dueDateForRoll = (roll: number): Date | null => {
      const t = now.getTime();
      if (roll < 0.1) return new Date(t - intInclusive(1, 30) * ONE_DAY_MS); // overdue
      if (roll < 0.2) return new Date(t); // today
      if (roll < 0.5) return new Date(t + intInclusive(1, 30) * ONE_DAY_MS); // upcoming
      if (roll < 0.8) return new Date(t + intInclusive(31, 365) * ONE_DAY_MS); // far
      return null;
    };

    const todoRows: Prisma.TodoCreateManyInput[] = [];
    const todoIds: string[] = [];

    for (let i = 0; i < TARGET_TODOS; i++) {
      const project = pickProject();
      const status = pickWeighted(rand, TODO_STATUS_DISTRIBUTION);
      const priority = pickWeighted(rand, TODO_PRIORITY_DISTRIBUTION);
      const completed = status === "done";
      const dueDate = dueDateForRoll(rand());
      const id = randomUUID();
      todoIds.push(id);
      todoRows.push({
        id,
        userId: user.id,
        projectId: project.id,
        title: `${pick(TODO_TITLE_TEMPLATES)} (#${i + 1})`,
        status,
        completed,
        completedAt: completed
          ? new Date(now.getTime() - intInclusive(0, 60) * ONE_DAY_MS)
          : null,
        priority,
        dueDate,
        order: i,
      });
    }

    await prisma.todo.createMany({ data: todoRows });

    // ~10% of todos get 1–3 subtasks.
    const subtaskRows: Array<{
      todoId: string;
      title: string;
      completed: boolean;
      order: number;
    }> = [];
    for (const todoId of todoIds) {
      if (rand() >= 0.1) continue;
      const count = intInclusive(1, 3);
      for (let i = 0; i < count; i++) {
        subtaskRows.push({
          todoId,
          title: pick(SUBTASK_TITLES),
          completed: rand() < 0.5,
          order: i,
        });
      }
    }
    if (subtaskRows.length > 0) {
      await prisma.subtask.createMany({ data: subtaskRows });
    }

    console.log(
      [
        "Seed complete",
        `  user: ${user.email} (password: ${DEMO_PASSWORD})`,
        `  projects: ${projects.length}`,
        `  todos: ${todoRows.length}`,
        `  subtasks: ${subtaskRows.length}`,
        `  PRNG seed: ${seedSeed}`,
      ].join("\n"),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
