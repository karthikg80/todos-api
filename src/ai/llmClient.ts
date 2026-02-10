import { config } from "../config";

export interface StructuredPlanResponse {
  payload: unknown;
  provider?: string;
  model?: string;
}

export interface LlmClient {
  generateStructuredPlan(
    input: string,
    context: Record<string, unknown>,
  ): Promise<StructuredPlanResponse>;
}

export class OpenAiCompatibleLlmClient implements LlmClient {
  async generateStructuredPlan(
    input: string,
    context: Record<string, unknown>,
  ): Promise<StructuredPlanResponse> {
    const response = await fetch(`${config.aiProviderBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.aiProviderApiKey}`,
      },
      body: JSON.stringify({
        model: config.aiProviderModel,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Return strict JSON for plan_from_goal with keys: schemaVersion(1), type(plan_from_goal), confidence(low|medium|high), assumptions[], questions[], tasks[]. Task keys: tempId,title,description,notes,category,projectName,dueDate(YYYY-MM-DD|null),priority(low|medium|high),subtasks[].",
          },
          {
            role: "user",
            content: JSON.stringify({
              input,
              context,
            }),
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI provider request failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI provider returned empty content");
    }

    return {
      payload: JSON.parse(content),
      provider: "openai-compatible",
      model: data.model || config.aiProviderModel,
    };
  }
}

export function createDefaultLlmClient(): LlmClient | undefined {
  if (!config.aiProviderEnabled) {
    return undefined;
  }
  return new OpenAiCompatibleLlmClient();
}
