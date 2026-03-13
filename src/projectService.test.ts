import { prisma } from "./prismaClient";
import {
  DuplicateProjectNameError,
  PrismaProjectService,
} from "./services/projectService";
import { PrismaTodoService } from "./services/prismaTodoService";

const TEST_USER_ID = "test-user-123";
const TEST_USER_ID_2 = "test-user-456";

describe("PrismaProjectService (Integration)", () => {
  let projectService: PrismaProjectService;
  let todoService: PrismaTodoService;

  beforeAll(() => {
    projectService = new PrismaProjectService(prisma);
    todoService = new PrismaTodoService(prisma);
  });

  beforeEach(async () => {
    await prisma.heading.deleteMany();
    await prisma.todo.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: "projects@example.com",
        password: "hashed-password",
        name: "Projects User",
      },
    });

    await prisma.user.create({
      data: {
        id: TEST_USER_ID_2,
        email: "projects-2@example.com",
        password: "hashed-password",
        name: "Projects User 2",
      },
    });
  });

  it("renames a project without rewriting the stored legacy category column", async () => {
    const project = await projectService.create(TEST_USER_ID, {
      name: "Work / Client A",
    });
    const todo = await todoService.create(TEST_USER_ID, {
      title: "Ship report",
      projectId: project.id,
    });

    const updated = await projectService.update(TEST_USER_ID, project.id, {
      name: "Work / Client B",
    });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe("Work / Client B");
    expect(updated?.archived).toBe(false);

    const refreshedTodo = await todoService.findById(TEST_USER_ID, todo.id);
    expect(refreshedTodo?.category).toBe("Work / Client B");

    const dbTodo = await prisma.todo.findUnique({
      where: { id: todo.id },
      include: { project: true },
    });
    expect(dbTodo?.category).toBe("Work / Client A");
    expect(dbTodo?.project?.name).toBe("Work / Client B");
  });

  it("rejects duplicate project names on rename", async () => {
    await projectService.create(TEST_USER_ID, { name: "Platform" });
    const project = await projectService.create(TEST_USER_ID, {
      name: "Support",
    });

    await expect(
      projectService.update(TEST_USER_ID, project.id, { name: "Platform" }),
    ).rejects.toBeInstanceOf(DuplicateProjectNameError);
  });

  it("deletes a project and reassigns its tasks when a target project is provided", async () => {
    const source = await projectService.create(TEST_USER_ID, { name: "Alpha" });
    const target = await projectService.create(TEST_USER_ID, { name: "Beta" });
    const todo = await todoService.create(TEST_USER_ID, {
      title: "Move me",
      projectId: source.id,
    });

    const deleted = await projectService.delete(
      TEST_USER_ID,
      source.id,
      "unsorted",
      target.id,
    );

    expect(deleted).toBe(true);
    expect(await projectService.findById(TEST_USER_ID, source.id)).toBeNull();

    const movedTodo = await todoService.findById(TEST_USER_ID, todo.id);
    expect(movedTodo?.category).toBe("Beta");

    const dbTodo = await prisma.todo.findUnique({
      where: { id: todo.id },
      include: { project: true },
    });
    expect(dbTodo?.projectId).toBe(target.id);
    expect(dbTodo?.project?.name).toBe("Beta");
    expect(dbTodo?.headingId).toBeNull();
  });

  it("deletes a project and unassigns its tasks when no reassignment target is provided", async () => {
    const source = await projectService.create(TEST_USER_ID, { name: "Alpha" });
    const todo = await todoService.create(TEST_USER_ID, {
      title: "Unassign me",
      projectId: source.id,
    });

    const deleted = await projectService.delete(
      TEST_USER_ID,
      source.id,
      "unsorted",
    );

    expect(deleted).toBe(true);

    const unassignedTodo = await todoService.findById(TEST_USER_ID, todo.id);
    expect(unassignedTodo?.category).toBeUndefined();

    const dbTodo = await prisma.todo.findUnique({
      where: { id: todo.id },
    });
    expect(dbTodo?.projectId).toBeNull();
    expect(dbTodo?.category).toBeNull();
    expect(dbTodo?.headingId).toBeNull();
  });

  it("toggles a project's archived state without changing ownership", async () => {
    const project = await projectService.create(TEST_USER_ID, {
      name: "Archive Me",
    });

    const archived = await projectService.setArchived(
      TEST_USER_ID,
      project.id,
      true,
    );
    expect(archived?.archived).toBe(true);

    const unarchived = await projectService.setArchived(
      TEST_USER_ID,
      project.id,
      false,
    );
    expect(unarchived?.archived).toBe(false);

    const projects = await projectService.findAll(TEST_USER_ID);
    expect(projects.find((item) => item.id === project.id)?.archived).toBe(
      false,
    );
  });
});
