/**
 * GraphQL Yoga Server (Schema-First)
 *
 * Architecture:
 *  - Schema read from schema.graphql at startup (strict schema-first per context.md)
 *  - Context factory verifies JWT on every request and attaches { currentUser }
 *  - GraphiQL enabled (all environments — disable in prod if needed)
 *  - Served via Bun.serve on port 4000
 */

import "dotenv/config";
import { createYoga, createSchema } from "graphql-yoga";
import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "./lib/prisma.ts";
import { verifyToken } from "./services/auth.service.ts";
import { resolvers } from "./graphql/resolvers/index.ts";
import type { GraphQLContext } from "./graphql/context.ts";

// ─── Schema ───────────────────────────────────────────────────────────────────

// Read the .graphql file at startup — this is the strict schema-first approach.
// Never generate schema from code; the .graphql file is the single source of truth.
const typeDefs = readFileSync(
  join(import.meta.dir, "graphql/schema.graphql"),
  "utf-8"
);

const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers,
});

// ─── Context factory ──────────────────────────────────────────────────────────

/**
 * Runs on every GraphQL request.
 * Extracts the Bearer token from the Authorization header,
 * verifies it, fetches the user from Prisma, and attaches them to context.
 * Invalid/missing tokens are silently ignored (currentUser = null).
 * Individual resolvers are responsible for throwing AUTH_REQUIRED errors.
 */
async function buildContext({
  request,
}: {
  request: Request;
}): Promise<GraphQLContext> {
  let currentUser: GraphQLContext["currentUser"] = null;

  const authHeader = request.headers.get("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7); // strip "Bearer "
    try {
      const payload = verifyToken(token);
      currentUser = await prisma.user.findUnique({
        where: { id: payload.userId },
      });
    } catch {
      // Expired or tampered token → treat as unauthenticated request
      currentUser = null;
    }
  }

  return { prisma, currentUser };
}

// ─── Yoga instance ────────────────────────────────────────────────────────────

const yoga = createYoga<GraphQLContext>({
  schema,
  context: buildContext,
  graphiql: true, // enables the GraphiQL IDE at /graphql
  logging: {
    debug: (...args) => console.debug(...args),
    info: (...args) => console.info(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
  },
});

// ─── Bun server ───────────────────────────────────────────────────────────────

const PORT = Number(process.env["PORT"] ?? 4000);

const server = Bun.serve({
  port: PORT,
  fetch: (req) => yoga.fetch(req),
});

console.log(`\n🚀  GraphQL server ready`);
console.log(`   GraphiQL UI  → http://localhost:${PORT}/graphql`);
console.log(`   API endpoint → http://localhost:${PORT}/graphql\n`);

export { server };
