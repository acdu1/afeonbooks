import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, sessionsTable, usersTable, type UserRow } from "@workspace/db";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "afeonbooks_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

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
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export async function destroySession(request: Request, response: Response): Promise<void> {
  const token = request.cookies?.[SESSION_COOKIE];
  if (token) await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(token)));
  response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
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