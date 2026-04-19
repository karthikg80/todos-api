import { PrismaClient } from "@prisma/client";
import { createLogger } from "../infra/logging/logger";
import { HttpError } from "../errorHandling";
import { AdaptationLlmInferenceService } from "./adaptationLlmInference";
import { UserAdaptationService } from "./userAdaptationService";
import type { SoftInference } from "../types";

const log = createLogger("adaptationProjectInferenceService");

export interface AdaptationProjectSoftInferenceResult {
  inference: SoftInference | null;
  reason: string;
  behavioralConfidence: number;
}

export class AdaptationProjectInferenceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly adaptationService: Pick<
      UserAdaptationService,
      "getOrCreateProfile"
    >,
    private readonly llmInferenceService: Pick<
      AdaptationLlmInferenceService,
      "inferProjectIntent"
    >,
  ) {}

  async getSoftInference(
    userId: string,
    projectId: string,
  ): Promise<AdaptationProjectSoftInferenceResult> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    if (!project) {
      throw new HttpError(404, "Project not found");
    }

    const profileResult =
      await this.adaptationService.getOrCreateProfile(userId);
    if (profileResult.profile.confidence >= 0.4) {
      return {
        inference: null,
        reason: "behavioral confidence sufficient — LLM inference skipped",
        behavioralConfidence: profileResult.profile.confidence,
      };
    }

    const [todos, headings] = await Promise.all([
      this.prisma.todo.findMany({
        where: { userId, projectId, archived: false },
        select: { title: true },
        take: 50,
      }),
      this.prisma.heading.findMany({
        where: { projectId },
        select: { name: true },
      }),
    ]);

    const inference = await this.llmInferenceService.inferProjectIntent({
      projectName: project.name,
      projectDescription: project.description,
      taskTitles: todos.map((todo) => todo.title),
      existingSectionNames: headings.map((heading) => heading.name),
    });

    log.info("Soft inference result", {
      userId,
      projectId,
      projectName: project.name,
      behavioralConfidence: profileResult.profile.confidence,
      llmConfidence: inference?.confidence ?? 0,
      inferredType: inference?.inferredProjectType,
    });

    return {
      inference,
      reason: inference ? "llm soft inference" : "llm provider not available",
      behavioralConfidence: profileResult.profile.confidence,
    };
  }
}
