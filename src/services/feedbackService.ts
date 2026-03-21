import { Prisma, PrismaClient } from "@prisma/client";
import {
  CreateFeedbackRequestDto,
  FeedbackRequestAdminDetailDto,
  FeedbackRequestAdminListItemDto,
  FeedbackTriageResultDto,
  FeedbackRequestDto,
  FeedbackAttachmentMetadataDto,
  ListAdminFeedbackRequestsQuery,
  UpdateAdminFeedbackRequestDto,
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

  async listForAdmin(
    filters: ListAdminFeedbackRequestsQuery,
  ): Promise<FeedbackRequestAdminListItemDto[]> {
    const records = await this.prisma.feedbackRequest.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.type ? { type: filters.type } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
    });

    return records.map((record) => this.toAdminDto(record));
  }

  async getForAdmin(id: string): Promise<FeedbackRequestAdminDetailDto | null> {
    const record = await this.prisma.feedbackRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return record ? this.toAdminDto(record) : null;
  }

  async updateReviewStatus(
    id: string,
    reviewerUserId: string,
    dto: UpdateAdminFeedbackRequestDto,
  ): Promise<FeedbackRequestAdminDetailDto> {
    const record = await this.prisma.feedbackRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        rejectionReason: dto.status === "rejected" ? dto.rejectionReason : null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return this.toAdminDto(record);
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
    status: "new" | "triaged" | "promoted" | "rejected";
    classification:
      | "bug"
      | "feature"
      | "support"
      | "duplicate_candidate"
      | "noise"
      | null;
    triageConfidence: number | null;
    normalizedTitle: string | null;
    normalizedBody: string | null;
    impactSummary: string | null;
    reproStepsJson: unknown;
    expectedBehavior: string | null;
    actualBehavior: string | null;
    proposedOutcome: string | null;
    agentLabelsJson: unknown;
    missingInfoJson: unknown;
    triageSummary: string | null;
    severity: string | null;
    dedupeKey: string | null;
    githubIssueNumber: number | null;
    githubIssueUrl: string | null;
    reviewedByUserId: string | null;
    reviewedAt: Date | null;
    rejectionReason: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): FeedbackRequestDto {
    const reproSteps = Array.isArray(record.reproStepsJson)
      ? record.reproStepsJson.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const agentLabels = Array.isArray(record.agentLabelsJson)
      ? record.agentLabelsJson.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const missingInfo = Array.isArray(record.missingInfoJson)
      ? record.missingInfoJson.filter(
          (value): value is string => typeof value === "string",
        )
      : [];

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
      classification: record.classification,
      triageConfidence: record.triageConfidence,
      normalizedTitle: record.normalizedTitle,
      normalizedBody: record.normalizedBody,
      impactSummary: record.impactSummary,
      reproSteps,
      expectedBehavior: record.expectedBehavior,
      actualBehavior: record.actualBehavior,
      proposedOutcome: record.proposedOutcome,
      agentLabels,
      missingInfo,
      triageSummary: record.triageSummary,
      severity: record.severity,
      dedupeKey: record.dedupeKey,
      githubIssueNumber: record.githubIssueNumber,
      githubIssueUrl: record.githubIssueUrl,
      reviewedByUserId: record.reviewedByUserId,
      reviewedAt: record.reviewedAt?.toISOString() ?? null,
      rejectionReason: record.rejectionReason,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toAdminDto(record: {
    id: string;
    userId: string;
    reviewedByUserId: string | null;
    type: "bug" | "feature" | "general";
    title: string;
    body: string;
    screenshotUrl: string | null;
    attachmentMetadata: unknown;
    pageUrl: string | null;
    userAgent: string | null;
    appVersion: string | null;
    status: "new" | "triaged" | "promoted" | "rejected";
    classification:
      | "bug"
      | "feature"
      | "support"
      | "duplicate_candidate"
      | "noise"
      | null;
    triageConfidence: number | null;
    normalizedTitle: string | null;
    normalizedBody: string | null;
    impactSummary: string | null;
    reproStepsJson: unknown;
    expectedBehavior: string | null;
    actualBehavior: string | null;
    proposedOutcome: string | null;
    agentLabelsJson: unknown;
    missingInfoJson: unknown;
    triageSummary: string | null;
    severity: string | null;
    dedupeKey: string | null;
    githubIssueNumber: number | null;
    githubIssueUrl: string | null;
    reviewedAt: Date | null;
    rejectionReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      email: string;
      name: string | null;
    };
    reviewer: {
      id: string;
      email: string;
      name: string | null;
    } | null;
  }): FeedbackRequestAdminDetailDto {
    return {
      ...this.toDto(record),
      user: record.user,
      reviewer: record.reviewer,
    };
  }
}
