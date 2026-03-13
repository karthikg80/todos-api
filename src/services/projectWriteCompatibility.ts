import { IProjectService } from "../interfaces/IProjectService";

type TodoProjectWriteShape = {
  projectId?: string | null;
  category?: string | null;
};

function normalizeLegacyCategory(category?: string | null): string | null {
  if (category === null || category === undefined) {
    return null;
  }

  const trimmed = category.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function resolveProjectByName(
  userId: string,
  projectName: string,
  projectService: IProjectService,
) {
  const findExisting = async () => {
    const projects = await projectService.findAll(userId);
    return projects.find((project) => project.name === projectName) ?? null;
  };

  const existing = await findExisting();
  if (existing) {
    return existing;
  }

  try {
    return await projectService.create(userId, { name: projectName });
  } catch (error) {
    const createdByConcurrentRequest = await findExisting();
    if (createdByConcurrentRequest) {
      return createdByConcurrentRequest;
    }
    throw error;
  }
}

export async function applyLegacyCategoryProjectWriteCompatibility<
  T extends TodoProjectWriteShape,
>(userId: string, dto: T, projectService?: IProjectService): Promise<T> {
  if (
    !projectService ||
    dto.projectId !== undefined ||
    dto.category === undefined
  ) {
    return dto;
  }

  const category = normalizeLegacyCategory(dto.category);
  if (!category) {
    return {
      ...dto,
      category: null,
      projectId: null,
    };
  }

  const project = await resolveProjectByName(userId, category, projectService);
  return {
    ...dto,
    category: project.name,
    projectId: project.id,
  };
}
