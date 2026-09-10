import { Router, type IRouter } from "express";
import { count, desc, eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
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
  }).returning();
  await createSession(user.id, res);
  res.status(201).json({ user: publicUser(user) });
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

router.get("/auth/users", requireUser, requireRole("admin"), async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json({ users: users.map(publicUser) });
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