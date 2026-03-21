import { config } from "../config";

export interface GitHubIssueMatch {
  number: number;
  url: string;
  title: string;
  state: string;
}

export interface GitHubIssueSearchAdapter {
  searchIssues(query: string): Promise<GitHubIssueMatch[]>;
}

export class GitHubIssueSearchService implements GitHubIssueSearchAdapter {
  async searchIssues(query: string): Promise<GitHubIssueMatch[]> {
    const url = new URL("/search/issues", config.githubApiBaseUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("per_page", "10");

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "todos-api-feedback-dedupe",
    };
    if (config.githubToken) {
      headers.Authorization = `Bearer ${config.githubToken}`;
    }

    const response = await fetch(url.toString(), { headers });
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
}
