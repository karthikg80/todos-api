function normalize(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(a|an|the|to|for|in|on|at|by|with|from|of)\b/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export interface TaskForDuplication {
  id: string;
  title: string;
  status: string;
  projectId: string | null;
}

export interface DuplicateGroup {
  confidence: number;
  reason: string;
  tasks: TaskForDuplication[];
  suggestedAction: "merge" | "archive-older" | "review";
}

export function findDuplicates(tasks: TaskForDuplication[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const paired = new Set<string>();

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i],
        b = tasks[j];
      const pairKey = `${a.id}:${b.id}`;
      if (paired.has(pairKey)) continue;

      const titleA = a.title.trim().toLowerCase();
      const titleB = b.title.trim().toLowerCase();
      const normA = normalize(a.title);
      const normB = normalize(b.title);

      // Exact match
      if (titleA === titleB) {
        paired.add(pairKey);
        groups.push({
          confidence: 1.0,
          reason: "Exact title match",
          tasks: [a, b],
          suggestedAction: "archive-older",
        });
        continue;
      }

      // Normalized match
      if (normA === normB && normA.length > 0) {
        paired.add(pairKey);
        groups.push({
          confidence: 0.9,
          reason: "Normalized title match (ignoring articles/punctuation)",
          tasks: [a, b],
          suggestedAction: "archive-older",
        });
        continue;
      }

      // Same project + fuzzy
      if (a.projectId && a.projectId === b.projectId) {
        const dist = levenshtein(normA, normB);
        const maxLen = Math.max(normA.length, normB.length);
        if (dist <= 3 && maxLen >= 5) {
          paired.add(pairKey);
          groups.push({
            confidence: 0.7,
            reason: `Similar titles in same project (edit distance: ${dist})`,
            tasks: [a, b],
            suggestedAction: "review",
          });
        }
      }
    }
  }

  return groups;
}
