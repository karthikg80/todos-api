import { PrismaClient, Prisma } from "@prisma/client";
import { IHeadingService } from "../interfaces/IHeadingService";
import { CreateHeadingDto, Heading, ReorderHeadingItemDto } from "../types";
import { hasPrismaCode } from "../errorHandling";

type PrismaHeadingRecord = Prisma.HeadingGetPayload<{}>;

export class PrismaHeadingService implements IHeadingService {
  constructor(private prisma: PrismaClient) {}

  async findAllByProject(
    userId: string,
    projectId: string,
  ): Promise<Heading[] | null> {
    try {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, userId },
        select: { id: true },
      });
      if (!project) return null;

      const headings = await this.prisma.heading.findMany({
        where: { projectId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      return headings.map((heading) => this.mapPrismaHeading(heading));
    } catch (error) {
      if (hasPrismaCode(error, ["P2023"])) {
        return null;
      }
      throw error;
    }
  }

  async create(
    userId: string,
    projectId: string,
    dto: CreateHeadingDto,
  ): Promise<Heading | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.findFirst({
          where: { id: projectId, userId },
          select: { id: true },
        });
        if (!project) return null;

        const maxHeading = await tx.heading.findFirst({
          where: { projectId },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });

        const heading = await tx.heading.create({
          data: {
            projectId,
            name: dto.name,
            sortOrder: (maxHeading?.sortOrder ?? -1) + 1,
          },
        });
        return this.mapPrismaHeading(heading);
      });
    } catch (error) {
      if (hasPrismaCode(error, ["P2023"])) {
        return null;
      }
      throw error;
    }
  }

  async reorder(
    userId: string,
    projectId: string,
    items: ReorderHeadingItemDto[],
  ): Promise<Heading[] | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.findFirst({
          where: { id: projectId, userId },
          select: { id: true },
        });
        if (!project) return null;

        const headings = await tx.heading.findMany({
          where: { projectId },
          select: { id: true, sortOrder: true },
        });
        const currentSortOrder = new Map(
          headings.map((heading) => [heading.id, heading.sortOrder]),
        );

        for (const item of items) {
          if (!currentSortOrder.has(item.id)) {
            return null;
          }
        }

        for (const item of items) {
          if (currentSortOrder.get(item.id) !== item.sortOrder) {
            await tx.heading.updateMany({
              where: { id: item.id, projectId },
              data: { sortOrder: item.sortOrder },
            });
          }
        }

        const ordered = await tx.heading.findMany({
          where: { projectId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });
        return ordered.map((heading) => this.mapPrismaHeading(heading));
      });
    } catch (error) {
      if (hasPrismaCode(error, ["P2023"])) {
        return null;
      }
      throw error;
    }
  }

  private mapPrismaHeading(heading: PrismaHeadingRecord): Heading {
    return {
      id: heading.id,
      projectId: heading.projectId,
      name: heading.name,
      sortOrder: heading.sortOrder,
      createdAt: heading.createdAt,
      updatedAt: heading.updatedAt,
    };
  }
}
