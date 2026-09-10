import { Router, type IRouter } from "express";
import { count, desc, eq } from "drizzle-orm";
import { db, loyaltyTransactionsTable, usersTable } from "@workspace/db";
import {
  consumeAuthToken,
  createAuthToken,
  createSession,
  destroySession,
  hashPassword,
  loadUser,
  normalizeEmail,
  publicUser,
  requireRole,
  requireUser,
  verifyPassword,
} from "../lib/auth";
import { sendEmail } from "../lib/email";

const SITE_URL = process.env.PUBLIC_SITE_URL || "https://afeonbooks.com";
const AUTH_FROM = process.env.ZOHO_AUTH_FROM_ADDRESS || "noreply@afeonbooks.com";

function authEmailHtml(title: string, intro: string, link: string, label: string): string {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;background:#FAF7F2;padding:32px"><div style="max-width:560px;margin:auto;background:#fff;padding:32px;border:1px solid #eee"><p style="font-size:12px;letter-spacing:2px;font-weight:bold;color:#888">AFEON BOOKS</p><h1>${escape(title)}</h1><p style="line-height:1.6">${escape(intro)}</p><p><a href="${escape(link)}" style="display:inline-block;background:#111;color:#fff;padding:14px 22px;text-decoration:none;font-weight:bold">${escape(label)}</a></p><p style="font-size:12px;color:#666;word-break:break-all">If the button does not work, use: ${escape(link)}</p></div></body></html>`;
}

async function sendAuthEmail(to: string, subject: string, html: string): Promise<void> {
  await sendEmail({ from: `AFEON Books <${AUTH_FROM}>`, to, subject, html });
}

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, name } = req.body as { email?: unknown; password?: unknown; name?: unknown };
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }
  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  if (typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
  if (existing[0]) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const [{ total }] = await db.select({ total: count() }).from(usersTable);
  const [user] = await db.insert(usersTable).values({
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    name: name.trim(),
    role: Number(total) === 0 ? "admin" : null,
    emailVerifiedAt: null,
  }).returning();
  const token = await createAuthToken(user.id, "verify_email", 1000 * 60 * 60 * 24);
  const link = `${SITE_URL}/account?verify_token=${encodeURIComponent(token)}`;
  try {
    await sendAuthEmail(user.email, "Verify your AFEON Books email", authEmailHtml("Verify your email", "Please verify your email address to activate your AFEON Books account.", link, "Verify email"));
  } catch (error) {
    await db.delete(usersTable).where(eq(usersTable.id, user.id));
    throw error;
  }
  res.status(201).json({ requiresVerification: true });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, normalizeEmail(email))).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  if (!user.emailVerifiedAt) {
    res.status(403).json({ error: "Please verify your email before signing in" });
    return;
  }
  await createSession(user.id, res);
  res.json({ user: publicUser(user) });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  await destroySession(req, res);
  res.status(204).send();
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await loadUser(req);
  res.json({ user: user ? publicUser(user) : null });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
  const [user] = email ? await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1) : [];
  if (user) {
    const token = await createAuthToken(user.id, "reset_password", 1000 * 60 * 30);
    const link = `${SITE_URL}/account?reset_token=${encodeURIComponent(token)}`;
    try {
      await sendAuthEmail(user.email, "Reset your AFEON Books password", authEmailHtml("Reset your password", "Use the link below to choose a new password. This link expires in 30 minutes.", link, "Reset password"));
    } catch (error) {
      console.error("Password reset email failed", error);
    }
  }
  res.json({ message: "If an account exists for that email, a reset link has been sent." });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  const userId = token ? await consumeAuthToken(token, "reset_password") : undefined;
  if (!userId) {
    res.status(400).json({ error: "This reset link is invalid or expired" });
    return;
  }
  const [user] = await db.update(usersTable).set({ passwordHash: await hashPassword(password) }).where(eq(usersTable.id, userId)).returning();
  if (!user) {
    res.status(400).json({ error: "This reset link is invalid or expired" });
    return;
  }
  await createSession(user.id, res);
  res.json({ user: publicUser(user) });
});

router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const userId = token ? await consumeAuthToken(token, "verify_email") : undefined;
  if (!userId) {
    res.status(400).json({ error: "This verification link is invalid or expired" });
    return;
  }
  const [user] = await db.update(usersTable).set({ emailVerifiedAt: new Date() }).where(eq(usersTable.id, userId)).returning();
  if (!user) {
    res.status(400).json({ error: "This verification link is invalid or expired" });
    return;
  }
  await createSession(user.id, res);
  res.json({ user: publicUser(user) });
});

router.get("/auth/users", requireUser, requireRole("admin"), async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json({ users: users.map(publicUser) });
});

router.get("/auth/loyalty", requireUser, async (req, res): Promise<void> => {
  const transactions = await db
    .select()
    .from(loyaltyTransactionsTable)
    .where(eq(loyaltyTransactionsTable.userId, req.user!.id))
    .orderBy(desc(loyaltyTransactionsTable.createdAt));
  res.json({
    balance: transactions.reduce((total, transaction) => total + transaction.points, 0),
    transactions,
  });
});

router.patch("/auth/users/:id/role", requireUser, requireRole("admin"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { role } = req.body as { role?: unknown };
  if (!Number.isInteger(id) || ![null, "staff", "admin"].includes(role as string | null)) {
    res.status(400).json({ error: "Role must be null, staff, or admin" });
    return;
  }
  if (id === req.user?.id && role !== "admin") {
    res.status(400).json({ error: "You cannot remove your own admin role" });
    return;
  }
  const [user] = await db.update(usersTable).set({ role: role as string | null }).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: publicUser(user) });
});

export default router;