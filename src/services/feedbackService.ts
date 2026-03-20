import { Prisma, PrismaClient } from "@prisma/client";
import {
  CreateFeedbackRequestDto,
  FeedbackRequestDto,
  FeedbackAttachmentMetadataDto,
} from "../types";

export class FeedbackService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    userId: string,
    dto: CreateFeedbackRequestDto,
  ): Promise<FeedbackRequestDto> {
    const record = await this.prisma.feedbackRequest.create({
      data: {
        userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        screenshotUrl: dto.screenshotUrl ?? null,
        attachmentMetadata:
          dto.attachmentMetadata === undefined
            ? undefined
            : dto.attachmentMetadata === null
              ? Prisma.JsonNull
              : (dto.attachmentMetadata as Prisma.InputJsonValue),
        pageUrl: dto.pageUrl ?? null,
        userAgent: dto.userAgent ?? null,
        appVersion: dto.appVersion ?? null,
      },
    });

    return this.toDto(record);
  }

  private toDto(record: {
    id: string;
    userId: string;
    type: "bug" | "feature" | "general";
    title: string;
    body: string;
    screenshotUrl: string | null;
    attachmentMetadata: unknown;
    pageUrl: string | null;
    userAgent: string | null;
    appVersion: string | null;
    status: "new" | "triaged" | "closed";
    triageSummary: string | null;
    severity: string | null;
    dedupeKey: string | null;
    githubIssueNumber: number | null;
    githubIssueUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): FeedbackRequestDto {
    return {
      id: record.id,
      userId: record.userId,
      type: record.type,
      title: record.title,
      body: record.body,
      screenshotUrl: record.screenshotUrl,
      attachmentMetadata:
        (record.attachmentMetadata as FeedbackAttachmentMetadataDto | null) ??
        null,
      pageUrl: record.pageUrl,
      userAgent: record.userAgent,
      appVersion: record.appVersion,
      status: record.status,
      triageSummary: record.triageSummary,
      severity: record.severity,
      dedupeKey: record.dedupeKey,
      githubIssueNumber: record.githubIssueNumber,
      githubIssueUrl: record.githubIssueUrl,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
