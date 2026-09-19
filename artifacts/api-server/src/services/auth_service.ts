import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@workspace/db";
import { authSessionsTable, usersTable } from "@workspace/db/schema";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "aegis_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export type AuthUser = Omit<typeof usersTable.$inferSelect, "passwordHash">;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [, salt, encoded] = stored.split(":");
  if (!salt || !encoded) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(encoded, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export async function createSession(userId: string, metadata: { ipAddress?: string; userAgent?: string }) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(authSessionsTable).values({
    userId,
    tokenHash: hashSessionToken(token),
    ipAddress: metadata.ipAddress ?? null,
    userAgent: metadata.userAgent ?? null,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export async function getUserFromSession(token?: string): Promise<AuthUser | null> {
  if (!token) return null;
  const [row] = await db.select({ user: usersTable })
    .from(authSessionsTable)
    .innerJoin(usersTable, eq(authSessionsTable.userId, usersTable.id))
    .where(and(eq(authSessionsTable.tokenHash, hashSessionToken(token)), gt(authSessionsTable.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  const { passwordHash: _passwordHash, ...user } = row.user;
  return user;
}

export async function revokeSession(token?: string) {
  if (token) await db.delete(authSessionsTable).where(eq(authSessionsTable.tokenHash, hashSessionToken(token)));
}

export { SESSION_COOKIE };
