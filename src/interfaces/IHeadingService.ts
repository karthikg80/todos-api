import { CreateHeadingDto, Heading } from "../types";

export interface IHeadingService {
  findAllByProject(
    userId: string,
    projectId: string,
  ): Promise<Heading[] | null>;
  create(
    userId: string,
    projectId: string,
    dto: CreateHeadingDto,
  ): Promise<Heading | null>;
}
