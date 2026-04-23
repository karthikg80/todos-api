import {
  createTodoDtoSchema,
  headingDtoSchema,
  mcpSessionSummaryDtoSchema,
  projectDtoSchema,
  todoDtoSchema,
  updateHeadingDtoSchema,
  updateTodoDtoSchema,
  userDtoSchema,
  userPlanningPreferencesDtoSchema,
} from "./index";

describe("transport contracts", () => {
  it("parses core transport DTOs with ISO string dates", () => {
    expect(
      todoDtoSchema.parse({
        id: "todo-1",
        title: "Write docs",
        status: "next",
        completed: false,
        tags: ["docs"],
        dependsOnTaskIds: [],
        order: 1,
        archived: false,
        userId: "user-1",
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T12:05:00.000Z",
      }),
    ).toEqual(
      expect.objectContaining({
        id: "todo-1",
        status: "next",
        createdAt: "2026-04-23T12:00:00.000Z",
      }),
    );

    expect(
      projectDtoSchema.parse({
        id: "project-1",
        name: "Ship contracts",
        status: "active",
        archived: false,
        userId: "user-1",
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T12:05:00.000Z",
      }),
    ).toEqual(
      expect.objectContaining({
        id: "project-1",
        status: "active",
      }),
    );

    expect(
      userDtoSchema.parse({
        id: "user-1",
        email: "user@example.com",
      }),
    ).toEqual(
      expect.objectContaining({
        id: "user-1",
        email: "user@example.com",
      }),
    );
  });

  it("parses supporting DTOs and update payloads", () => {
    expect(
      headingDtoSchema.parse({
        id: "heading-1",
        projectId: "project-1",
        name: "Next",
        sortOrder: 0,
      }),
    ).toEqual(
      expect.objectContaining({
        id: "heading-1",
        projectId: "project-1",
      }),
    );

    expect(
      userPlanningPreferencesDtoSchema.parse({
        weekendsActive: true,
        preferredContexts: ["computer"],
        waitingFollowUpDays: 3,
        soulProfile: {
          lifeAreas: ["work"],
          failureModes: ["avoidance"],
          planningStyle: "structure",
          energyPattern: "morning",
          goodDayThemes: ["momentum"],
          tone: "focused",
          dailyRitual: "morning_plan",
        },
      }),
    ).toEqual(
      expect.objectContaining({
        weekendsActive: true,
        waitingFollowUpDays: 3,
      }),
    );

    expect(
      mcpSessionSummaryDtoSchema.parse({
        id: "session-1",
        userId: "user-1",
        scopes: ["tasks.read"],
        source: "oauth",
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T12:05:00.000Z",
      }),
    ).toEqual(
      expect.objectContaining({
        id: "session-1",
        source: "oauth",
      }),
    );

    expect(
      createTodoDtoSchema.parse({
        title: "Capture follow-up",
        status: "inbox",
      }),
    ).toEqual(
      expect.objectContaining({
        title: "Capture follow-up",
        status: "inbox",
      }),
    );

    expect(
      updateTodoDtoSchema.parse({
        priority: "high",
        recurrence: { type: "weekly" },
      }),
    ).toEqual(
      expect.objectContaining({
        priority: "high",
        recurrence: { type: "weekly" },
      }),
    );

    expect(updateHeadingDtoSchema.parse({ name: "Later" })).toEqual({
      name: "Later",
    });
  });
});
