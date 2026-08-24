/**
 * Auth Service
 *
 * Handles all authentication primitives:
 *  - Password hashing / verification via argon2
 *  - JWT generation / verification
 *
 * This module has NO side effects and NO Prisma calls — pure functions only.
 * Prisma interactions live in the resolvers.
 */

import { hash, verify } from "@node-rs/argon2";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";

// ─── JWT config ──────────────────────────────────────────────────────────────

const JWT_SECRET: string =
  process.env["JWT_SECRET"] ?? "fallback-secret-change-in-production";

const JWT_EXPIRES_IN = "7d";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// ─── Password helpers ─────────────────────────────────────────────────────────

/**
 * Hash a plaintext password using argon2id (default algorithm).
 * Safe to store directly in the database.
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/**
 * Verify a plaintext password against an argon2 hash.
 * Returns true if they match, false otherwise.
 *
 * verify(hash, plain) — note the argument order.
 */
export async function verifyPassword(
  plainPassword: string,
  storedHash: string
): Promise<boolean> {
  return verify(storedHash, plainPassword);
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

/**
 * Sign a JWT containing the user's id, email, and role.
 * Expires in 7 days by default.
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT.
 * Throws if the token is invalid or expired.
 */
export function verifyToken(token: string): JWTPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }
  return decoded as JWTPayload;
}
