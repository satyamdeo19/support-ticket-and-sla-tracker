/**
 * Prisma client singleton with the @prisma/adapter-pg driver adapter.
 *
 * Prisma 7 removed the built-in TCP connector — you must pass a driver adapter.
 * We use @prisma/adapter-pg (wraps the `pg` library) for a direct PostgreSQL
 * connection using the DATABASE_URL from the environment.
 *
 * dotenv/config is imported first so DATABASE_URL is available immediately.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient(): PrismaClient {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. Check backend/.env"
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Keep the singleton across hot-reloads in development
if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}
