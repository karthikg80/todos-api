import { PrismaClient } from "@prisma/client";
import { config } from "./config";

// Singleton Prisma Client instance
const prismaClientSingleton = () => {
  return new PrismaClient({
    datasourceUrl: config.databaseUrl,
    log:
      config.nodeEnv === "development" ? ["query", "error", "warn"] : ["error"],
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined;
}

// Prevent multiple instances in development (hot reload)
export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

// Graceful shutdown
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
