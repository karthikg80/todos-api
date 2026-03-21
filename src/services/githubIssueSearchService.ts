import { config } from "../config";

export interface GitHubIssueMatch {
  number: number;
  url: string;
  title: string;
  state: string;
}

export interface CreateGitHubIssueInput {
  title: string;
  body: string;
}

export interface CreateGitHubIssueResult {
  number: number;
  url: string;
}

export interface GitHubIssueSearchAdapter {
  searchIssues(query: string): Promise<GitHubIssueMatch[]>;
}

export interface GitHubIssueAdapter extends GitHubIssueSearchAdapter {
  createIssue(input: CreateGitHubIssueInput): Promise<CreateGitHubIssueResult>;
  applyLabels(issueNumber: number, labels: string[]): Promise<string[]>;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "todos-api-feedback-promotion",
  };
  if (config.githubToken) {
    headers.Authorization = `Bearer ${config.githubToken}`;
  }
  return headers;
}

function buildIssuesUrl(pathname: string): URL {
  return new URL(pathname, config.githubApiBaseUrl);
}

export class GitHubIssueSearchService implements GitHubIssueAdapter {
  async searchIssues(query: string): Promise<GitHubIssueMatch[]> {
    const url = buildIssuesUrl("/search/issues");
    url.searchParams.set("q", query);
    url.searchParams.set("per_page", "10");

    const response = await fetch(url.toString(), { headers: buildHeaders() });
    if (!response.ok) {
      throw new Error(
        `GitHub issue search failed with status ${response.status}`,
      );
    }

    const data = (await response.json()) as {
      items?: Array<{
        number?: number;
        html_url?: string;
        title?: string;
        state?: string;
        pull_request?: unknown;
      }>;
    };

    return (data.items || [])
      .filter((item) => !item.pull_request)
      .flatMap((item) => {
        if (
          typeof item.number !== "number" ||
          typeof item.html_url !== "string" ||
          typeof item.title !== "string"
        ) {
          return [];
        }

        return [
          {
            number: item.number,
            url: item.html_url,
            title: item.title,
            state: typeof item.state === "string" ? item.state : "open",
          },
        ];
      });
  }

  async createIssue(
    input: CreateGitHubIssueInput,
  ): Promise<CreateGitHubIssueResult> {
    const response = await fetch(
      buildIssuesUrl(`/repos/${config.githubRepo}/issues`).toString(),
      {
        method: "POST",
        headers: {
          ...buildHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: input.title,
          body: input.body,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(
        `GitHub issue creation failed with status ${response.status}`,
      );
    }

    const data = (await response.json()) as {
      number?: number;
      html_url?: string;
    };
    if (typeof data.number !== "number" || typeof data.html_url !== "string") {
      throw new Error("GitHub issue creation returned an invalid response");
    }

    return {
      number: data.number,
      url: data.html_url,
    };
  }

  async applyLabels(issueNumber: number, labels: string[]): Promise<string[]> {
    if (!labels.length) {
      return [];
    }

    const response = await fetch(
      buildIssuesUrl(
        `/repos/${config.githubRepo}/issues/${issueNumber}/labels`,
      ).toString(),
      {
        method: "POST",
        headers: {
          ...buildHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ labels }),
      },
    );
    if (!response.ok) {
      throw new Error(
        `GitHub label apply failed with status ${response.status}`,
      );
    }

    const data = (await response.json()) as Array<{ name?: string }>;
    return Array.isArray(data)
      ? data
          .map((item) => item.name)
          .filter((value): value is string => typeof value === "string")
      : [];
  }
}
