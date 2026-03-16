import { PrismaClient } from "@prisma/client";
import { CaptureItemDto } from "../types";

export class CaptureService {
  constructor(private prisma: PrismaClient) {}

  async create(
    userId: string,
    text: string,
    source?: string,
    capturedAt?: Date,
  ): Promise<CaptureItemDto> {
    const item = await this.prisma.captureItem.create({
      data: {
        userId,
        text,
        source: source ?? null,
        capturedAt: capturedAt ?? new Date(),
      },
    });
    return this.toDto(item);
  }

  async findAll(
    userId: string,
    lifecycle?: "new" | "triaged" | "discarded",
  ): Promise<CaptureItemDto[]> {
    const items = await this.prisma.captureItem.findMany({
      where: { userId, ...(lifecycle ? { lifecycle } : {}) },
      orderBy: { capturedAt: "desc" },
    });
    return items.map((item) => this.toDto(item));
  }

  async findById(userId: string, id: string): Promise<CaptureItemDto | null> {
    const item = await this.prisma.captureItem.findFirst({
      where: { id, userId },
    });
    return item ? this.toDto(item) : null;
  }

  async updateLifecycle(
    userId: string,
    id: string,
    lifecycle: "new" | "triaged" | "discarded",
    triageResult?: unknown,
  ): Promise<CaptureItemDto | null> {
    const result = await this.prisma.captureItem.updateMany({
      where: { id, userId },
      data: {
        lifecycle,
        ...(triageResult !== undefined
          ? { triageResult: triageResult as object }
          : {}),
      },
    });
    if (result.count === 0) return null;
    return this.findById(userId, id);
  }

  private toDto(item: {
    id: string;
    text: string;
    source: string | null;
    capturedAt: Date;
    lifecycle: string;
    triageResult: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): CaptureItemDto {
    return {
      id: item.id,
      text: item.text,
      source: item.source,
      capturedAt: item.capturedAt.toISOString(),
      lifecycle: item.lifecycle as "new" | "triaged" | "discarded",
      triageResult: item.triageResult,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
