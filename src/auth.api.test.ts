import request from "supertest";
import { createApp } from "./app";
import { PrismaTodoService } from "./prismaTodoService";
import { AuthService } from "./authService";
import { prisma } from "./prismaClient";
import { PrismaProjectService } from "./projectService";

describe("Authentication API", () => {
  let app: any;
  let authService: AuthService;
  let todoService: PrismaTodoService;
  let projectService: PrismaProjectService;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-for-api-tests";
    todoService = new PrismaTodoService(prisma);
    authService = new AuthService(prisma);
    projectService = new PrismaProjectService(prisma);
    app = createApp(
      todoService,
      authService,
      undefined,
      undefined,
      undefined,
      undefined,
      projectService,
    );
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.todo.deleteMany();
    await prisma.user.deleteMany();
  });

  describe("POST /auth/register", () => {
    it("should register new user successfully", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "newuser@example.com",
          password: "password123",
          name: "New User",
        })
        .expect(201);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe("newuser@example.com");
      expect(response.body.user.name).toBe("New User");
      expect(response.body.user.id).toBeDefined();
      expect(response.body.token).toBeDefined();
      expect(response.body.user.password).toBeUndefined();
    });

    it("should register user without name", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "noname@example.com",
          password: "password123",
        })
        .expect(201);

      expect(response.body.user.email).toBe("noname@example.com");
      expect(response.body.user.name).toBeNull();
    });

    it("should return 400 for missing email", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          password: "password123",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].field).toBe("email");
    });

    it("should return 400 for missing password", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "test@example.com",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.errors[0].field).toBe("password");
    });

    it("should return 400 for invalid email format", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "invalid-email",
          password: "password123",
        })
        .expect(400);

      expect(response.body.errors[0].field).toBe("email");
      expect(response.body.errors[0].message).toContain("Invalid email format");
    });

    it("should return 400 for short password", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "test@example.com",
          password: "short",
        })
        .expect(400);

      expect(response.body.errors[0].field).toBe("password");
      expect(response.body.errors[0].message).toContain(
        "at least 8 characters",
      );
    });

    it("should return 400 for email too long", async () => {
      const longEmail = "a".repeat(250) + "@example.com";
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: longEmail,
          password: "password123",
        })
        .expect(400);

      expect(response.body.errors[0].field).toBe("email");
    });

    it("should return 409 for duplicate email", async () => {
      // Register first user
      await request(app)
        .post("/auth/register")
        .send({
          email: "duplicate@example.com",
          password: "password123",
        })
        .expect(201);

      // Try to register with same email
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "duplicate@example.com",
          password: "password456",
        })
        .expect(409);

      expect(response.body.error).toBe("Email already registered");
    });

    it("should return 400 for empty email", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "   ",
          password: "password123",
        })
        .expect(400);

      expect(response.body.errors[0].field).toBe("email");
      expect(response.body.errors[0].message).toContain("cannot be empty");
    });

    it("should return 400 for name too long", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "test@example.com",
          password: "password123",
          name: "a".repeat(101),
        })
        .expect(400);

      expect(response.body.errors[0].field).toBe("name");
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      // Create a test user
      await request(app).post("/auth/register").send({
        email: "logintest@example.com",
        password: "correctpassword",
        name: "Login Test",
      });
    });

    it("should login with correct credentials", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: "logintest@example.com",
          password: "correctpassword",
        })
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe("logintest@example.com");
      expect(response.body.user.name).toBe("Login Test");
      expect(response.body.token).toBeDefined();
      expect(response.body.user.password).toBeUndefined();
    });

    it("should return 401 for incorrect password", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: "logintest@example.com",
          password: "wrongpassword",
        })
        .expect(401);

      expect(response.body.error).toBe("Invalid credentials");
    });

    it("should return 401 for non-existent email", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "password123",
        })
        .expect(401);

      expect(response.body.error).toBe("Invalid credentials");
    });

    it("should return 400 for missing email", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          password: "password123",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation failed");
      expect(response.body.errors[0].field).toBe("email");
    });

    it("should return 400 for missing password", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: "test@example.com",
        })
        .expect(400);

      expect(response.body.errors[0].field).toBe("password");
    });

    it("should return 400 for empty email", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: "",
          password: "password123",
        })
        .expect(400);

      expect(response.body.errors[0].field).toBe("email");
    });

    it("should return 400 for empty password", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: "test@example.com",
          password: "",
        })
        .expect(400);

      expect(response.body.errors[0].field).toBe("password");
    });
  });

  describe("Refresh token lifecycle", () => {
    it("should reject refresh when refresh token is missing", async () => {
      const response = await request(app)
        .post("/auth/refresh")
        .send({})
        .expect(400);

      expect(response.body.error).toBe("Refresh token required");
    });

    it("should rotate refresh token and invalidate the old one", async () => {
      const register = await request(app).post("/auth/register").send({
        email: "rotate@example.com",
        password: "password123",
      });

      const firstRefreshToken = register.body.refreshToken as string;

      const refreshResponse = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: firstRefreshToken })
        .expect(200);

      const secondRefreshToken = refreshResponse.body.refreshToken as string;
      expect(secondRefreshToken).toBeDefined();
      expect(secondRefreshToken).not.toBe(firstRefreshToken);

      const reusedOldToken = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: firstRefreshToken })
        .expect(401);

      expect(reusedOldToken.body.error).toBe("Invalid refresh token");

      await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: secondRefreshToken })
        .expect(200);
    });

    it("should revoke refresh token on logout", async () => {
      const register = await request(app).post("/auth/register").send({
        email: "logout-refresh@example.com",
        password: "password123",
      });

      const refreshToken = register.body.refreshToken as string;
      await request(app)
        .post("/auth/logout")
        .send({ refreshToken })
        .expect(200);

      const refreshAfterLogout = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken })
        .expect(401);

      expect(refreshAfterLogout.body.error).toBe("Invalid refresh token");
    });

    it("should return 409 and remove token when refresh token is expired", async () => {
      const register = await request(app).post("/auth/register").send({
        email: "expired-refresh@example.com",
        password: "password123",
      });
      const userId = register.body.user.id as string;
      const refreshToken = register.body.refreshToken as string;

      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { expiresAt: new Date(Date.now() - 60 * 1000) },
      });

      const expiredResponse = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken })
        .expect(409);

      expect(expiredResponse.body.error).toBe("Refresh token expired");

      const tokenCount = await prisma.refreshToken.count({ where: { userId } });
      expect(tokenCount).toBe(0);
    });
  });

  describe("Admin bootstrap provisioning", () => {
    it("should require auth for bootstrap status", async () => {
      await request(app).get("/auth/bootstrap-admin/status").expect(401);
    });

    it("should allow first user to bootstrap admin with valid secret", async () => {
      const registerResponse = await request(app)
        .post("/auth/register")
        .send({
          email: "bootstrap@example.com",
          password: "password123",
        })
        .expect(201);

      const token = registerResponse.body.token;

      const statusResponse = await request(app)
        .get("/auth/bootstrap-admin/status")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(statusResponse.body).toEqual({ enabled: true });

      const promoteResponse = await request(app)
        .post("/auth/bootstrap-admin")
        .set("Authorization", `Bearer ${token}`)
        .send({ secret: "test-admin-bootstrap-secret" })
        .expect(200);

      expect(promoteResponse.body.user).toBeDefined();
      expect(promoteResponse.body.user.role).toBe("admin");

      const meResponse = await request(app)
        .get("/users/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(meResponse.body.role).toBe("admin");
    });

    it("should reject invalid bootstrap secret", async () => {
      const registerResponse = await request(app)
        .post("/auth/register")
        .send({
          email: "wrongsecret@example.com",
          password: "password123",
        })
        .expect(201);

      await request(app)
        .post("/auth/bootstrap-admin")
        .set("Authorization", `Bearer ${registerResponse.body.token}`)
        .send({ secret: "wrong-secret" })
        .expect(403);
    });

    it("should block bootstrap when admin already exists", async () => {
      const firstUser = await request(app)
        .post("/auth/register")
        .send({
          email: "firstadmin@example.com",
          password: "password123",
        })
        .expect(201);

      await request(app)
        .post("/auth/bootstrap-admin")
        .set("Authorization", `Bearer ${firstUser.body.token}`)
        .send({ secret: "test-admin-bootstrap-secret" })
        .expect(200);

      const secondUser = await request(app)
        .post("/auth/register")
        .send({
          email: "seconduser@example.com",
          password: "password123",
        })
        .expect(201);

      const statusResponse = await request(app)
        .get("/auth/bootstrap-admin/status")
        .set("Authorization", `Bearer ${secondUser.body.token}`)
        .expect(200);
      expect(statusResponse.body).toEqual({
        enabled: false,
        reason: "already_provisioned",
      });

      await request(app)
        .post("/auth/bootstrap-admin")
        .set("Authorization", `Bearer ${secondUser.body.token}`)
        .send({ secret: "test-admin-bootstrap-secret" })
        .expect(409);
    });
  });

  describe("Protected Routes", () => {
    let authToken: string;
    let userId: string;

    beforeEach(async () => {
      // Register and login to get a token
      const response = await request(app).post("/auth/register").send({
        email: "protected@example.com",
        password: "password123",
        name: "Protected Test",
      });

      authToken = response.body.token;
      userId = response.body.user.id;
    });

    describe("GET /todos", () => {
      it("should return 401 without token", async () => {
        const response = await request(app).get("/todos").expect(401);

        expect(response.body.error).toBe("Authorization header missing");
      });

      it("should return 401 with invalid token", async () => {
        const response = await request(app)
          .get("/todos")
          .set("Authorization", "Bearer invalid-token")
          .expect(401);

        expect(response.body.error).toBe("Invalid token");
      });

      it("should return 401 with malformed authorization header", async () => {
        const response = await request(app)
          .get("/todos")
          .set("Authorization", "InvalidFormat token")
          .expect(401);

        expect(response.body.error).toContain("Invalid authorization format");
      });

      it("should return todos with valid token", async () => {
        const response = await request(app)
          .get("/todos")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe("POST /todos", () => {
      it("should return 401 without token", async () => {
        await request(app)
          .post("/todos")
          .send({ title: "Test Todo" })
          .expect(401);
      });

      it("should create todo with valid token", async () => {
        const response = await request(app)
          .post("/todos")
          .set("Authorization", `Bearer ${authToken}`)
          .send({
            title: "Authenticated Todo",
            description: "Created with JWT",
          })
          .expect(201);

        expect(response.body.title).toBe("Authenticated Todo");
        expect(response.body.userId).toBe(userId);
      });
    });

    describe("Projects", () => {
      it("creates, lists, renames, and deletes a project", async () => {
        const created = await request(app)
          .post("/projects")
          .set("Authorization", `Bearer ${authToken}`)
          .send({ name: "Work / Client A" })
          .expect(201);

        expect(created.body.name).toBe("Work / Client A");
        expect(created.body.id).toEqual(expect.any(String));

        const listed = await request(app)
          .get("/projects")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);
        expect(Array.isArray(listed.body)).toBe(true);
        expect(listed.body.map((p: any) => p.name)).toContain(
          "Work / Client A",
        );

        const updated = await request(app)
          .put(`/projects/${created.body.id}`)
          .set("Authorization", `Bearer ${authToken}`)
          .send({ name: "Work / Client B" })
          .expect(200);
        expect(updated.body.name).toBe("Work / Client B");

        await request(app)
          .delete(`/projects/${created.body.id}`)
          .set("Authorization", `Bearer ${authToken}`)
          .expect(204);
      });

      it("enforces user isolation for project access", async () => {
        const otherUser = await request(app).post("/auth/register").send({
          email: "project-other@example.com",
          password: "password123",
          name: "Other User",
        });
        const otherToken = otherUser.body.token as string;

        const created = await request(app)
          .post("/projects")
          .set("Authorization", `Bearer ${authToken}`)
          .send({ name: "Private Project" })
          .expect(201);

        await request(app)
          .put(`/projects/${created.body.id}`)
          .set("Authorization", `Bearer ${otherToken}`)
          .send({ name: "Hacked Project" })
          .expect(404);

        await request(app)
          .delete(`/projects/${created.body.id}`)
          .set("Authorization", `Bearer ${otherToken}`)
          .expect(404);
      });
    });

    describe("User Isolation", () => {
      let user1Token: string;
      let user2Token: string;
      let user1TodoId: string;

      beforeEach(async () => {
        // Create user 1 and todo
        const user1Response = await request(app).post("/auth/register").send({
          email: "user1@example.com",
          password: "password123",
        });
        user1Token = user1Response.body.token;

        const todo1Response = await request(app)
          .post("/todos")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({ title: "User 1 Todo" });
        user1TodoId = todo1Response.body.id;

        // Create user 2
        const user2Response = await request(app).post("/auth/register").send({
          email: "user2@example.com",
          password: "password123",
        });
        user2Token = user2Response.body.token;
      });

      it("should not allow user to access another users todo", async () => {
        const response = await request(app)
          .get(`/todos/${user1TodoId}`)
          .set("Authorization", `Bearer ${user2Token}`)
          .expect(404);

        expect(response.body.error).toBe("Todo not found");
      });

      it("should not allow user to update another users todo", async () => {
        const response = await request(app)
          .put(`/todos/${user1TodoId}`)
          .set("Authorization", `Bearer ${user2Token}`)
          .send({ title: "Hacked" })
          .expect(404);

        expect(response.body.error).toBe("Todo not found");
      });

      it("should not allow user to delete another users todo", async () => {
        await request(app)
          .delete(`/todos/${user1TodoId}`)
          .set("Authorization", `Bearer ${user2Token}`)
          .expect(404);

        // Verify todo still exists for user 1
        const response = await request(app)
          .get(`/todos/${user1TodoId}`)
          .set("Authorization", `Bearer ${user1Token}`)
          .expect(200);

        expect(response.body.title).toBe("User 1 Todo");
      });

      it("should only return users own todos", async () => {
        // Create todo for user 2
        await request(app)
          .post("/todos")
          .set("Authorization", `Bearer ${user2Token}`)
          .send({ title: "User 2 Todo" });

        // User 1 should only see their own todo
        const user1Response = await request(app)
          .get("/todos")
          .set("Authorization", `Bearer ${user1Token}`)
          .expect(200);

        expect(user1Response.body).toHaveLength(1);
        expect(user1Response.body[0].title).toBe("User 1 Todo");

        // User 2 should only see their own todo
        const user2Response = await request(app)
          .get("/todos")
          .set("Authorization", `Bearer ${user2Token}`)
          .expect(200);

        expect(user2Response.body).toHaveLength(1);
        expect(user2Response.body[0].title).toBe("User 2 Todo");
      });
    });
  });

  describe("Critical response contracts", () => {
    function expectUserShape(user: any) {
      expect(user).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: expect.any(String),
        }),
      );
    }

    function expectTodoShape(todo: any) {
      expect(todo).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
          completed: expect.any(Boolean),
          userId: expect.any(String),
        }),
      );
    }

    it("enforces auth response shape for register/login/refresh", async () => {
      const register = await request(app)
        .post("/auth/register")
        .send({
          email: "contract-auth@example.com",
          password: "password123",
          name: "Contract Auth",
        })
        .expect(201);

      expectUserShape(register.body.user);
      expect(register.body.token).toEqual(expect.any(String));
      expect(register.body.refreshToken).toEqual(expect.any(String));

      const login = await request(app)
        .post("/auth/login")
        .send({
          email: "contract-auth@example.com",
          password: "password123",
        })
        .expect(200);

      expectUserShape(login.body.user);
      expect(login.body.token).toEqual(expect.any(String));
      expect(login.body.refreshToken).toEqual(expect.any(String));

      const refresh = await request(app)
        .post("/auth/refresh")
        .send({ refreshToken: login.body.refreshToken })
        .expect(200);

      expect(refresh.body.token).toEqual(expect.any(String));
      expect(refresh.body.refreshToken).toEqual(expect.any(String));
      expect(refresh.body.refreshToken).not.toBe(login.body.refreshToken);
    });

    it("enforces /users/me and /todos response shapes", async () => {
      const register = await request(app)
        .post("/auth/register")
        .send({
          email: "contract-data@example.com",
          password: "password123",
        })
        .expect(201);

      const token = register.body.token as string;

      const me = await request(app)
        .get("/users/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expectUserShape(me.body);
      expect(me.body).toEqual(
        expect.objectContaining({
          isVerified: expect.any(Boolean),
          role: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
      );

      const created = await request(app)
        .post("/todos")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Contract Todo" })
        .expect(201);
      expectTodoShape(created.body);

      const list = await request(app)
        .get("/todos")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(Array.isArray(list.body)).toBe(true);
      expect(list.body.length).toBeGreaterThan(0);
      expectTodoShape(list.body[0]);
    });
  });
});
