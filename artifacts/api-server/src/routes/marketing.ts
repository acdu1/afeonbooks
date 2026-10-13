import { Router, type IRouter } from "express";
import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { bannersTable, db, promoCodesTable } from "@workspace/db";
import { requireRole, requireUser } from "../lib/auth";

const router: IRouter = Router();

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function validColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function bannerInput(body: Record<string, unknown>) {
  const startsAt = parseDate(body.startsAt);
  const endsAt = parseDate(body.endsAt);
  if (
    typeof body.title !== "string" || !body.title.trim() || body.title.length > 100 ||
    typeof body.message !== "string" || !body.message.trim() || body.message.length > 500 ||
    typeof body.linkUrl !== "string" || typeof body.linkLabel !== "string" ||
    !validColor(body.backgroundColor) || !validColor(body.textColor) ||
    typeof body.active !== "boolean" || startsAt === undefined || endsAt === undefined ||
    (startsAt && endsAt && startsAt >= endsAt)
  ) return null;
  if (body.linkUrl && !((body.linkUrl.startsWith("/") && !body.linkUrl.startsWith("//")) || /^https:\/\//i.test(body.linkUrl))) return null;
  return {
    title: body.title.trim(),
    message: body.message.trim(),
    linkUrl: body.linkUrl.trim(),
    linkLabel: body.linkLabel.trim().slice(0, 40),
    backgroundColor: body.backgroundColor,
    textColor: body.textColor,
    active: body.active,
    startsAt,
    endsAt,
  };
}

function promoInput(body: Record<string, unknown>) {
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const expiresAt = parseDate(body.expiresAt);
  const maxUses = body.maxUses === null || body.maxUses === "" ? null : Number(body.maxUses);
  if (
    !/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code) ||
    !["percent", "fixed"].includes(String(body.discountType)) ||
    !Number.isInteger(body.discountValue) || Number(body.discountValue) < 0 ||
    (body.discountType === "percent" && Number(body.discountValue) > 100) ||
    typeof body.active !== "boolean" || expiresAt === undefined ||
    (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1))
  ) return null;
  return {
    code,
    discountType: body.discountType as "percent" | "fixed",
    discountValue: Number(body.discountValue),
    active: body.active,
    expiresAt,
    maxUses,
  };
}

function serializeBanner(banner: typeof bannersTable.$inferSelect) {
  return { ...banner, startsAt: banner.startsAt?.toISOString() ?? null, endsAt: banner.endsAt?.toISOString() ?? null, createdAt: banner.createdAt.toISOString() };
}

function serializePromo(promo: typeof promoCodesTable.$inferSelect) {
  return { ...promo, expiresAt: promo.expiresAt?.toISOString() ?? null, createdAt: promo.createdAt.toISOString() };
}

router.get("/banners/active", async (_req, res) => {
  const now = new Date();
  const [banner] = await db.select().from(bannersTable).where(and(
    eq(bannersTable.active, true),
    or(isNull(bannersTable.startsAt), lte(bannersTable.startsAt, now)),
    or(isNull(bannersTable.endsAt), gt(bannersTable.endsAt, now)),
  )).orderBy(desc(bannersTable.createdAt)).limit(1);
  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  res.json(banner ? serializeBanner(banner) : null);
});

router.get("/admin/banners", requireUser, requireRole("admin"), async (_req, res) => {
  const banners = await db.select().from(bannersTable).orderBy(desc(bannersTable.createdAt));
  res.setHeader("Cache-Control", "no-store");
  res.json(banners.map(serializeBanner));
});

router.post("/admin/banners", requireUser, requireRole("admin"), async (req, res) => {
  const input = bannerInput(req.body as Record<string, unknown>);
  if (!input) { res.status(400).json({ error: "Check the banner fields and schedule." }); return; }
  const [banner] = await db.insert(bannersTable).values(input).returning();
  res.status(201).json(serializeBanner(banner!));
});

router.put("/admin/banners/:id", requireUser, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const input = bannerInput(req.body as Record<string, unknown>);
  if (!Number.isInteger(id) || id < 1 || !input) { res.status(400).json({ error: "Check the banner fields and schedule." }); return; }
  const [banner] = await db.update(bannersTable).set(input).where(eq(bannersTable.id, id)).returning();
  if (!banner) { res.status(404).json({ error: "Banner not found." }); return; }
  res.json(serializeBanner(banner));
});

router.delete("/admin/banners/:id", requireUser, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Invalid banner." }); return; }
  await db.delete(bannersTable).where(eq(bannersTable.id, id));
  res.status(204).send();
});

router.get("/admin/promo-codes", requireUser, requireRole("admin"), async (_req, res) => {
  const promos = await db.select().from(promoCodesTable).orderBy(desc(promoCodesTable.createdAt));
  res.setHeader("Cache-Control", "no-store");
  res.json(promos.map(serializePromo));
});

router.post("/admin/promo-codes", requireUser, requireRole("admin"), async (req, res) => {
  const input = promoInput(req.body as Record<string, unknown>);
  if (!input) { res.status(400).json({ error: "Check the promo code, discount, and limits." }); return; }
  try {
    const [promo] = await db.insert(promoCodesTable).values(input).returning();
    res.status(201).json(serializePromo(promo!));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") { res.status(409).json({ error: "That promo code already exists." }); return; }
    throw error;
  }
});

router.put("/admin/promo-codes/:id", requireUser, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const input = promoInput(req.body as Record<string, unknown>);
  if (!Number.isInteger(id) || id < 1 || !input) { res.status(400).json({ error: "Check the promo code, discount, and limits." }); return; }
  try {
    const [promo] = await db.update(promoCodesTable).set(input).where(eq(promoCodesTable.id, id)).returning();
    if (!promo) { res.status(404).json({ error: "Promo code not found." }); return; }
    res.json(serializePromo(promo));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") { res.status(409).json({ error: "That promo code already exists." }); return; }
    throw error;
  }
});

router.delete("/admin/promo-codes/:id", requireUser, requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Invalid promo code." }); return; }
  await db.delete(promoCodesTable).where(eq(promoCodesTable.id, id));
  res.status(204).send();
});

router.post("/promo-codes/apply", async (req, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
  const subtotalCents = Number(req.body?.subtotalCents);
  if (!code || !Number.isSafeInteger(subtotalCents) || subtotalCents < 0) {
    res.status(400).json({ valid: false, error: "Enter a valid promo code." });
    return;
  }
  const now = new Date();
  const [promo] = await db.select().from(promoCodesTable).where(and(
    eq(promoCodesTable.code, code),
    eq(promoCodesTable.active, true),
    or(isNull(promoCodesTable.expiresAt), gt(promoCodesTable.expiresAt, now)),
    or(isNull(promoCodesTable.maxUses), gt(promoCodesTable.maxUses, promoCodesTable.useCount)),
  )).limit(1);
  if (!promo) { res.status(400).json({ valid: false, error: "This promo code is invalid or unavailable." }); return; }
  const discountCents = promo.discountType === "percent"
    ? Math.floor(subtotalCents * promo.discountValue / 100)
    : Math.min(subtotalCents, promo.discountValue);
  res.setHeader("Cache-Control", "no-store");
  res.json({ valid: true, code: promo.code, discountCents });
});

export default router;