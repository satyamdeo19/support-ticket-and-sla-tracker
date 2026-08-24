/**
 * Auth Resolvers — register and login mutations.
 *
 * Rules enforced here:
 *  - Duplicate email → VALIDATION_ERROR
 *  - Wrong password  → AUTHENTICATION_ERROR (deliberately vague to prevent enumeration)
 *  - Passwords are NEVER stored in plaintext — always hashed via argon2id
 */

import { GraphQLError } from "graphql";
import type { UserRole } from "@prisma/client";
import type { GraphQLContext } from "../context.ts";
import {
  hashPassword,
  verifyPassword,
  generateToken,
} from "../../services/auth.service.ts";

// ─── Argument types ───────────────────────────────────────────────────────────

interface RegisterArgs {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

interface LoginArgs {
  email: string;
  password: string;
}

// ─── Resolvers ────────────────────────────────────────────────────────────────

export const authResolvers = {
  Mutation: {
    /**
     * Register a new user.
     * Hashes the password via argon2id, saves to DB, returns JWT + User.
     */
    register: async (
      _parent: unknown,
      args: RegisterArgs,
      ctx: GraphQLContext
    ) => {
      // Guard: duplicate email
      const existing = await ctx.prisma.user.findUnique({
        where: { email: args.email },
      });

      if (existing) {
        throw new GraphQLError("A user with that email already exists.", {
          extensions: { code: "VALIDATION_ERROR" },
        });
      }

      const passwordHash = await hashPassword(args.password);

      const user = await ctx.prisma.user.create({
        data: {
          name: args.name,
          email: args.email,
          passwordHash,
          role: args.role ?? "REPORTER",
        },
      });

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      return { token, user };
    },

    /**
     * Log in an existing user.
     * Returns JWT + User, or throws AUTHENTICATION_ERROR (never leaks whether
     * the email exists to prevent user enumeration attacks).
     */
    login: async (
      _parent: unknown,
      args: LoginArgs,
      ctx: GraphQLContext
    ) => {
      const user = await ctx.prisma.user.findUnique({
        where: { email: args.email },
      });

      // Deliberate: same error for "not found" and "wrong password"
      const INVALID_CREDENTIALS = new GraphQLError(
        "Invalid email or password.",
        { extensions: { code: "AUTHENTICATION_ERROR" } }
      );

      if (!user) throw INVALID_CREDENTIALS;

      const valid = await verifyPassword(args.password, user.passwordHash);
      if (!valid) throw INVALID_CREDENTIALS;

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      return { token, user };
    },
  },
};
