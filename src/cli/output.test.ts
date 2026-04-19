import {
  Spinner,
  colorPriority,
  formatTodoDetail,
  formatTodoTable,
  formatUserInfo,
  printError,
  printJson,
  printSuccess,
  shortId,
  spinner,
  statusSymbol,
} from "./output";

describe("cli/output", () => {
  const originalIsTTY = process.stderr.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stderr, "isTTY", {
      configurable: true,
      value: originalIsTTY,
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("formats priorities, statuses, ids, users, and todo details", () => {
    expect(colorPriority("urgent")).toContain("urgent");
    expect(colorPriority(null)).toContain("—");
    expect(statusSymbol("done")).toContain("✓");
    expect(statusSymbol("custom")).toContain("custom");
    expect(shortId("1234567890abcdef")).toContain("12345678");

    expect(
      formatUserInfo({
        id: "user-1",
        email: "user@example.com",
        name: "Test User",
        role: "admin",
        plan: "pro",
      }),
    ).toContain("user@example.com");

    const detail = formatTodoDetail({
      id: "todo-1",
      title: "Write tests",
      status: "in_progress",
      priority: "high",
      description: "Add CLI coverage",
      dueDate: "2026-04-20",
      project: { name: "Infra" },
      tags: ["cli", "coverage"],
      notes: "Keep it narrow",
      createdAt: "2026-04-19T00:00:00.000Z",
      updatedAt: "2026-04-19T01:00:00.000Z",
    });

    expect(detail).toContain("Write tests");
    expect(detail).toContain("Infra");
    expect(detail).toContain("cli, coverage");
  });

  it("formats todo tables for empty and populated states", () => {
    expect(formatTodoTable([])).toContain("No todos found.");

    const table = formatTodoTable(
      [
        {
          id: "1234567890abcdef",
          status: "next",
          title: "Finish refactor",
          priority: "medium",
          dueDate: "2099-01-01T00:00:00.000Z",
        },
      ],
      { noColor: true },
    );

    expect(table).toContain("Finish refactor");
    expect(table).toContain("12345678");
    expect(table).toContain("medium");
  });

  it("runs spinner lifecycle methods against stderr output", () => {
    jest.useFakeTimers();
    const writeSpy = jest
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    Object.defineProperty(process.stderr, "isTTY", {
      configurable: true,
      value: true,
    });

    const activeSpinner = spinner("Working");
    expect(activeSpinner).toBeInstanceOf(Spinner);
    expect(activeSpinner.start()).toBe(activeSpinner);

    jest.advanceTimersByTime(100);
    expect(writeSpy).toHaveBeenCalled();

    activeSpinner.succeed("Done");
    activeSpinner.fail("Failed");

    expect(
      writeSpy.mock.calls.some((call) => String(call[0]).includes("Done")),
    ).toBe(true);
    expect(
      writeSpy.mock.calls.some((call) => String(call[0]).includes("Failed")),
    ).toBe(true);
  });

  it("does not animate when stderr is not a tty and prints terminal helpers", () => {
    Object.defineProperty(process.stderr, "isTTY", {
      configurable: true,
      value: false,
    });

    const writeSpy = jest
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    new Spinner("Quiet").start();
    expect(writeSpy).not.toHaveBeenCalled();

    printJson({ ok: true });
    printSuccess("Saved");
    printError("Boom");

    expect(logSpy).toHaveBeenCalledWith('{\n  "ok": true\n}');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Saved"));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Boom"));
  });
});
