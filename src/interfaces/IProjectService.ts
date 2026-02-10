import { CreateProjectDto, Project, UpdateProjectDto } from "../types";

export interface IProjectService {
  findAll(userId: string): Promise<Project[]>;
  create(userId: string, dto: CreateProjectDto): Promise<Project>;
  update(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<Project | null>;
  delete(userId: string, projectId: string): Promise<boolean>;
}
