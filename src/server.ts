import { createApp } from "./app";
import { PrismaTodoService } from "./services/prismaTodoService";
import { AuthService } from "./services/authService";
import { prisma, disconnectPrisma } from "./prismaClient";
import { config } from "./config";
import { PrismaAiSuggestionStore } from "./services/aiSuggestionStore";
import { PrismaProjectService } from "./services/projectService";
import { PrismaHeadingService } from "./services/prismaHeadingService";

const PORT = config.port;

const todoService = new PrismaTodoService(prisma);
const authService = new AuthService(prisma);
const aiSuggestionStore = new PrismaAiSuggestionStore(prisma);
const projectService = new PrismaProjectService(prisma);
const headingService = new PrismaHeadingService(prisma);
const app = createApp(
  todoService,
  authService,
  aiSuggestionStore,
  undefined,
  undefined,
  undefined,
  projectService,
  undefined,
  headingService,
);

app.get("/healthz", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "todos-api",
    now: new Date().toISOString(),
  });
});

app.get("/readyz", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      ok: true,
      service: "todos-api",
      database: "ready",
      now: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Readiness check failed", error);
    res.status(503).json({
      ok: false,
      service: "todos-api",
      database: "unavailable",
      now: new Date().toISOString(),
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Todos API server running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(
    `Database: ${config.databaseUrl ? "Connected" : "Not configured"}`,
  );
});

server.requestTimeout = config.requestTimeoutMs;
server.headersTimeout = config.headersTimeoutMs;
server.keepAliveTimeout = config.keepAliveTimeoutMs;

// Graceful shutdown handlers
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    console.log("HTTP server closed");
  });

  try {
    await disconnectPrisma();
    console.log("Database connections closed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
