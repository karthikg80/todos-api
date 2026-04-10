import { randomUUID } from "crypto";
import { IHeadingService } from "../interfaces/IHeadingService";
import {
  CreateHeadingDto,
  Heading,
  ReorderHeadingItemDto,
  UpdateHeadingDto,
} from "../types";
import { IProjectService } from "../interfaces/IProjectService";

export class HeadingService implements IHeadingService {
  private headings = new Map<string, Heading>();

  constructor(private projectService?: IProjectService) {}

  private async projectExists(userId: string, projectId: string) {
    if (!this.projectService) return false;
    const projects = await this.projectService.findAll(userId);
    return projects.some((project) => project.id === projectId);
  }

  async findAllByProject(
    userId: string,
    projectId: string,
  ): Promise<Heading[] | null> {
    const exists = await this.projectExists(userId, projectId);
    if (!exists) return null;
    return Array.from(this.headings.values())
      .filter((heading) => heading.projectId === projectId)
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      );
  }

  async create(
    userId: string,
    projectId: string,
    dto: CreateHeadingDto,
  ): Promise<Heading | null> {
    const list = await this.findAllByProject(userId, projectId);
    if (list === null) return null;
    const now = new Date();
    const maxOrder = list.length
      ? Math.max(...list.map((heading) => heading.sortOrder))
      : -1;
    const heading: Heading = {
      id: randomUUID(),
      projectId,
      name: dto.name,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };
    this.headings.set(heading.id, heading);
    return heading;
  }

  async update(
    userId: string,
    projectId: string,
    headingId: string,
    dto: UpdateHeadingDto,
  ): Promise<Heading | null> {
    const list = await this.findAllByProject(userId, projectId);
    if (list === null) return null;
    const existing = list.find((heading) => heading.id === headingId);
    if (!existing) return null;
    const updated: Heading = {
      ...existing,
      name: dto.name ?? existing.name,
      updatedAt: new Date(),
    };
    this.headings.set(headingId, updated);
    return updated;
  }

  async delete(
    userId: string,
    projectId: string,
    headingId: string,
  ): Promise<boolean | null> {
    const list = await this.findAllByProject(userId, projectId);
    if (list === null) return null;
    const existing = list.find((heading) => heading.id === headingId);
    if (!existing) return null;
    this.headings.delete(headingId);
    return true;
  }

  async reorder(
    userId: string,
    projectId: string,
    items: ReorderHeadingItemDto[],
  ): Promise<Heading[] | null> {
    const list = await this.findAllByProject(userId, projectId);
    if (list === null) return null;
    const currentById = new Map(list.map((heading) => [heading.id, heading]));
    for (const item of items) {
      if (!currentById.has(item.id)) {
        return null;
      }
    }

    const now = new Date();
    for (const item of items) {
      const existing = currentById.get(item.id)!;
      const updated: Heading = {
        ...existing,
        sortOrder: item.sortOrder,
        updatedAt: now,
      };
      this.headings.set(item.id, updated);
    }

    return this.findAllByProject(userId, projectId);
  }
}
