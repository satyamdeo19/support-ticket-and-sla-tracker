/**
 * GraphQL context type shared across all resolvers.
 * Attached by the context factory in server.ts on every request.
 */
import type { PrismaClient, User } from "@prisma/client";

export interface GraphQLContext {
  prisma: PrismaClient;
  currentUser: User | null;
}
