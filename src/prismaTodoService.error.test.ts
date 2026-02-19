import { PrismaTodoService } from "./prismaTodoService";

describe("PrismaTodoService error handling", () => {
  function createService(todoOverrides: Partial<any>) {
    const prisma: any = {
      todo: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
        ...todoOverrides,
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      async (callback: (tx: any) => Promise<any>) => callback(prisma),
    );

    return new PrismaTodoService(prisma);
  }

  it("findById should return null for invalid UUID errors", async () => {
    const service = createService({
      findFirst: jest.fn().mockRejectedValue({ code: "P2023" }),
    });

    await expect(service.findById("user-1", "bad-id")).resolves.toBeNull();
  });

  it("findById should rethrow unknown errors", async () => {
    const service = createService({
      findFirst: jest.fn().mockRejectedValue(new Error("database unavailable")),
    });

    await expect(service.findById("user-1", "todo-1")).rejects.toThrow(
      "database unavailable",
    );
  });

  it("update should return null for expected Prisma not-found/invalid-id errors", async () => {
    const service = createService({
      updateMany: jest.fn().mockRejectedValue({ code: "P2023" }),
    });

    await expect(
      service.update("user-1", "bad-id", { title: "x" }),
    ).resolves.toBeNull();
  });

  it("update should rethrow unknown errors", async () => {
    const service = createService({
      updateMany: jest
        .fn()
        .mockRejectedValue(new Error("database unavailable")),
    });

    await expect(
      service.update("user-1", "todo-1", { title: "x" }),
    ).rejects.toThrow("database unavailable");
  });

  it("delete should return false for expected Prisma not-found/invalid-id errors", async () => {
    const service = createService({
      deleteMany: jest.fn().mockRejectedValue({ code: "P2023" }),
    });

    await expect(service.delete("user-1", "bad-id")).resolves.toBe(false);
  });

  it("delete should rethrow unknown errors", async () => {
    const service = createService({
      deleteMany: jest
        .fn()
        .mockRejectedValue(new Error("database unavailable")),
    });

    await expect(service.delete("user-1", "todo-1")).rejects.toThrow(
      "database unavailable",
    );
  });

  it("reorder should return null for invalid UUID errors", async () => {
    const service = createService({
      findMany: jest.fn().mockRejectedValue({ code: "P2023" }),
    });

    await expect(
      service.reorder("user-1", [{ id: "bad-id", order: 0 }]),
    ).resolves.toBeNull();
  });

  it("reorder should return null when todo not found", async () => {
    const service = createService({
      findMany: jest.fn().mockResolvedValue([]),
    });

    await expect(
      service.reorder("user-1", [{ id: "missing-id", order: 0 }]),
    ).resolves.toBeNull();
  });

  it("reorder should rethrow unknown errors", async () => {
    const service = createService({
      findMany: jest.fn().mockRejectedValue(new Error("database unavailable")),
    });

    await expect(
      service.reorder("user-1", [{ id: "todo-1", order: 0 }]),
    ).rejects.toThrow("database unavailable");
  });
});
