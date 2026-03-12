import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Todo API",
      version: "1.0.0",
      description:
        "A production-ready REST API for managing todos with JWT authentication",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
      {
        url: "https://todos.karthikg.in",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "User ID",
            },
            email: {
              type: "string",
              format: "email",
              description: "User email address",
            },
            name: {
              type: "string",
              nullable: true,
              description: "User display name",
            },
            isVerified: {
              type: "boolean",
              description: "Whether the user email is verified",
            },
            role: {
              type: "string",
              enum: ["user", "admin"],
              description: "User role",
            },
            plan: {
              type: "string",
              enum: ["free", "pro", "team"],
              description: "Subscription plan",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Account creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Last update timestamp",
            },
          },
        },
        Todo: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Todo ID",
            },
            title: {
              type: "string",
              maxLength: 200,
              description: "Todo title",
            },
            description: {
              type: "string",
              maxLength: 1000,
              nullable: true,
              description: "Todo description",
            },
            status: {
              type: "string",
              enum: [
                "inbox",
                "next",
                "in_progress",
                "waiting",
                "scheduled",
                "someday",
                "done",
                "cancelled",
              ],
              description: "Workflow status",
            },
            completed: {
              type: "boolean",
              description: "Completion status",
            },
            projectId: {
              type: "string",
              format: "uuid",
              nullable: true,
              description: "Canonical project relationship",
            },
            category: {
              type: "string",
              maxLength: 50,
              nullable: true,
              description: "Legacy category / project compatibility field",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Task tags",
            },
            context: {
              type: "string",
              nullable: true,
              description: "Execution context",
            },
            energy: {
              type: "string",
              enum: ["low", "medium", "high"],
              nullable: true,
              description: "Energy requirement",
            },
            headingId: {
              type: "string",
              format: "uuid",
              nullable: true,
              description: "Optional heading relationship inside a project",
            },
            dueDate: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Due date",
            },
            startDate: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Start date",
            },
            scheduledDate: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Scheduled date",
            },
            reviewDate: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Review date",
            },
            completedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Completion timestamp",
            },
            estimateMinutes: {
              type: "integer",
              nullable: true,
              minimum: 0,
              description: "Estimated effort in minutes",
            },
            waitingOn: {
              type: "string",
              nullable: true,
              description: "External dependency or person blocking the task",
            },
            dependsOnTaskIds: {
              type: "array",
              items: {
                type: "string",
                format: "uuid",
              },
              description: "Task dependencies",
            },
            order: {
              type: "integer",
              description: "Display order (ascending)",
            },
            archived: {
              type: "boolean",
              description: "Whether the task is archived",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
              description: "Priority level",
            },
            recurrence: {
              type: "object",
              nullable: true,
              properties: {
                type: {
                  type: "string",
                  enum: [
                    "none",
                    "daily",
                    "weekly",
                    "monthly",
                    "yearly",
                    "rrule",
                  ],
                },
                interval: {
                  type: "integer",
                  nullable: true,
                },
                rrule: {
                  type: "string",
                  nullable: true,
                },
                nextOccurrence: {
                  type: "string",
                  format: "date-time",
                  nullable: true,
                },
              },
              description: "Recurrence metadata",
            },
            source: {
              type: "string",
              enum: ["manual", "chat", "email", "import", "automation"],
              nullable: true,
              description: "Task creation source",
            },
            createdByPrompt: {
              type: "string",
              nullable: true,
              description: "Prompt that created the task when applicable",
            },
            notes: {
              type: "string",
              maxLength: 10000,
              nullable: true,
              description: "Additional notes",
            },
            userId: {
              type: "string",
              format: "uuid",
              description: "Owner user ID",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Last update timestamp",
            },
            subtasks: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Subtask",
              },
              description: "Child subtasks",
            },
          },
        },
        Project: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Project ID",
            },
            name: {
              type: "string",
              maxLength: 50,
              description: "Project path/name",
            },
            description: {
              type: "string",
              nullable: true,
              description: "Project description",
            },
            status: {
              type: "string",
              enum: ["active", "on_hold", "completed", "archived"],
              description: "Project workflow status",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
              nullable: true,
              description: "Project priority",
            },
            area: {
              type: "string",
              nullable: true,
              description: "Higher-level area of responsibility",
            },
            goal: {
              type: "string",
              nullable: true,
              description: "Project goal or outcome",
            },
            targetDate: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Target completion date",
            },
            reviewCadence: {
              type: "string",
              enum: ["weekly", "biweekly", "monthly", "quarterly"],
              nullable: true,
              description: "Review cadence",
            },
            lastReviewedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Last project review timestamp",
            },
            archived: {
              type: "boolean",
              description: "Whether the project is archived",
            },
            archivedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Archive timestamp",
            },
            userId: {
              type: "string",
              format: "uuid",
              description: "Owner user ID",
            },
            taskCount: {
              type: "integer",
              description: "Number of tasks linked to this project",
            },
            openTaskCount: {
              type: "integer",
              description: "Number of incomplete tasks linked to this project",
            },
            completedTaskCount: {
              type: "integer",
              description: "Number of completed tasks linked to this project",
            },
            todoCount: {
              type: "integer",
              description: "Number of todos linked to this project",
            },
            openTodoCount: {
              type: "integer",
              description: "Number of incomplete todos linked to this project",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Last update timestamp",
            },
          },
        },
        Subtask: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Subtask ID",
            },
            title: {
              type: "string",
              maxLength: 200,
              description: "Subtask title",
            },
            completed: {
              type: "boolean",
              description: "Completion status",
            },
            order: {
              type: "integer",
              description: "Display order (ascending)",
            },
            completedAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Completion timestamp",
            },
            todoId: {
              type: "string",
              format: "uuid",
              description: "Parent todo ID",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Last update timestamp",
            },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            user: {
              $ref: "#/components/schemas/User",
            },
            token: {
              type: "string",
              description: "JWT access token (short-lived)",
            },
            refreshToken: {
              type: "string",
              description: "Refresh token for obtaining new access tokens",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message",
            },
          },
        },
        ValidationError: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message",
            },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: {
                    type: "string",
                  },
                  message: {
                    type: "string",
                  },
                },
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication and registration",
      },
      {
        name: "Users",
        description: "User profile management",
      },
      {
        name: "Todos",
        description: "Todo CRUD operations",
      },
      {
        name: "Projects",
        description: "Project management and organization",
      },
      {
        name: "AI",
        description: "AI-assisted planning and task quality endpoints",
      },
    ],
  },
  apis: ["./src/app.ts", "./src/routes/*.ts"], // Path to API docs
};

export const swaggerSpec = swaggerJsdoc(options);
