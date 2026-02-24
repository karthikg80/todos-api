import { createApp } from "./app";
import { PrismaTodoService } from "./prismaTodoService";
import { AuthService } from "./authService";
import { prisma, disconnectPrisma } from "./prismaClient";
import { config } from "./config";
import { PrismaAiSuggestionStore } from "./aiSuggestionStore";
import { PrismaProjectService } from "./projectService";
import { PrismaHeadingService } from "./prismaHeadingService";

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

const server = app.listen(PORT, () => {
  console.log(`Todos API server running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(
    `Database: ${config.databaseUrl ? "Connected" : "Not configured"}`,
  );
});

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
