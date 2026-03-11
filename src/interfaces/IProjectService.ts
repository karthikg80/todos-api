import {
  CreateProjectDto,
  Project,
  ProjectTaskDisposition,
  UpdateProjectDto,
} from "../types";

export interface IProjectService {
  findAll(userId: string): Promise<Project[]>;
  findById(userId: string, projectId: string): Promise<Project | null>;
  create(userId: string, dto: CreateProjectDto): Promise<Project>;
  update(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<Project | null>;
  setArchived(
    userId: string,
    projectId: string,
    archived: boolean,
  ): Promise<Project | null>;
  delete(
    userId: string,
    projectId: string,
    taskDisposition: ProjectTaskDisposition,
    moveTasksToProjectId?: string | null,
  ): Promise<boolean>;
}
