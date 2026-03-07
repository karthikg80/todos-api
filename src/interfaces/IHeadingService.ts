import { CreateHeadingDto, Heading, ReorderHeadingItemDto } from "../types";

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
  reorder(
    userId: string,
    projectId: string,
    items: ReorderHeadingItemDto[],
  ): Promise<Heading[] | null>;
}
