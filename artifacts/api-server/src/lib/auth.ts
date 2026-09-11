import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { authTokensTable, db, sessionsTable, usersTable, type UserRow } from "@workspace/db";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "afeonbooks_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
const SESSION_COOKIE_DOMAIN = IS_PRODUCTION ? ".afeonbooks.com" : undefined;

declare global {
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAuthToken(userId: number, type: "verify_email" | "reset_password", ttlMs: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.delete(authTokensTable).where(and(eq(authTokensTable.userId, userId), eq(authTokensTable.type, type)));
  await db.insert(authTokensTable).values({
    userId,
    tokenHash: hashToken(token),
    type,
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

export async function consumeAuthToken(token: string, type: "verify_email" | "reset_password"): Promise<number | undefined> {
  const [found] = await db
    .select()
    .from(authTokensTable)
    .where(and(eq(authTokensTable.tokenHash, hashToken(token)), eq(authTokensTable.type, type), isNull(authTokensTable.usedAt), gt(authTokensTable.expiresAt, new Date())))
    .limit(1);
  if (!found) return undefined;
  const [used] = await db
    .update(authTokensTable)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokensTable.id, found.id), isNull(authTokensTable.usedAt)))
    .returning({ userId: authTokensTable.userId });
  return used?.userId;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, "hex");
  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
}

export function publicUser(user: UserRow) {
  return { id: user.id, email: user.email, name: user.name, role: user.role ?? "customer", createdAt: user.createdAt.toISOString() };
}

export async function createSession(userId: number, response: Response): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessionsTable).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    domain: SESSION_COOKIE_DOMAIN,
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export async function destroySession(request: Request, response: Response): Promise<void> {
  const token = request.cookies?.[SESSION_COOKIE];
  if (token) await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(token)));
  response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", domain: SESSION_COOKIE_DOMAIN, path: "/" });
}

export async function loadUser(request: Request): Promise<UserRow | undefined> {
  const token = request.cookies?.[SESSION_COOKIE];
  if (!token) return undefined;
  const rows = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(and(eq(sessionsTable.tokenHash, hashToken(token)), gt(sessionsTable.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user;
}

export async function requireUser(request: Request, response: Response, next: NextFunction): Promise<void> {
  request.user = await loadUser(request);
  if (!request.user) {
    response.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!request.user || !roles.includes(request.user.role ?? "customer")) {
      response.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    next();
  };
}

export { normalizeEmail };