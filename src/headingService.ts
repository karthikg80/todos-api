import { randomUUID } from "crypto";
import { IHeadingService } from "./interfaces/IHeadingService";
import { CreateHeadingDto, Heading } from "./types";
import { IProjectService } from "./interfaces/IProjectService";

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
}
