import {
  CreateHeadingDto,
  Heading,
  ReorderHeadingItemDto,
  UpdateHeadingDto,
} from "../types";

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
  update(
    userId: string,
    projectId: string,
    headingId: string,
    dto: UpdateHeadingDto,
  ): Promise<Heading | null>;
  delete(
    userId: string,
    projectId: string,
    headingId: string,
  ): Promise<boolean | null>;
  reorder(
    userId: string,
    projectId: string,
    items: ReorderHeadingItemDto[],
  ): Promise<Heading[] | null>;
}
