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
            completed: {
              type: "boolean",
              description: "Completion status",
            },
            category: {
              type: "string",
              maxLength: 50,
              nullable: true,
              description: "Todo category",
            },
            dueDate: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Due date",
            },
            order: {
              type: "integer",
              description: "Display order (ascending)",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "Priority level",
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
            userId: {
              type: "string",
              format: "uuid",
              description: "Owner user ID",
            },
            todoCount: {
              type: "integer",
              description: "Number of todos linked to this project",
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
