import { Router, type IRouter } from "express";
import { db, siteContentTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getOrCreateContent } from "./content";
import { requireRole, requireUser } from "../lib/auth";

const router: IRouter = Router();

const attempts: Map<string, { count: number; lockedUntil: number }> = new Map();

router.post("/admin/verify-pin", async (req, res): Promise<void> => {
  const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const record = attempts.get(ip) ?? { count: 0, lockedUntil: 0 };

  if (record.lockedUntil > now) {
    const secs = Math.ceil((record.lockedUntil - now) / 1000);
    res.status(429).json({ error: `Too many attempts. Try again in ${secs}s.` });
    return;
  }

  const { pin } = req.body as { pin?: unknown };
  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    res.status(400).json({ error: "PIN must be exactly 4 digits" });
    return;
  }

  const content = await getOrCreateContent();
  const success = content.adminPin === pin;

  if (success) {
    attempts.delete(ip);
    res.json({ success: true });
  } else {
    record.count += 1;
    if (record.count >= 5) {
      record.lockedUntil = now + 30_000;
      record.count = 0;
    }
    attempts.set(ip, record);
    res.json({ success: false });
  }
});

router.put("/admin/pin", requireUser, requireRole("admin"), async (req, res): Promise<void> => {
  const { newPin } = req.body as { newPin?: unknown };
  if (typeof newPin !== "string" || !/^\d{4}$/.test(newPin)) {
    res.status(400).json({ error: "PIN must be exactly 4 digits" });
    return;
  }
  const content = await getOrCreateContent();
  await db
    .update(siteContentTable)
    .set({ adminPin: newPin })
    .where(eq(siteContentTable.id, content.id));
  res.json({ success: true });
});

export default router;
