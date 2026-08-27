import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, orderItemsTable, ordersTable, siteContentTable } from "@workspace/db";
import { renderEmailHtml, sendEmail, applyVars, buildVars } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || "https://afeonbooks.afeonbooks.workers.dev";

router.post("/orders/:id/resend-email", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ ok: false, message: "Invalid order ID" });
      return;
    }

    if (!process.env.MAILERSEND_API_KEY) {
      res.status(503).json({ ok: false, message: "MAILERSEND_API_KEY is not configured on the server." });
      return;
    }

    const order = (await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1))[0];
    if (!order) {
      res.status(404).json({ ok: false, message: "Order not found" });
      return;
    }

    const items = await db
      .select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, id));

    const content = (
      await db
        .select()
        .from(siteContentTable)
        .where(eq(siteContentTable.school, order.school))
        .orderBy(asc(siteContentTable.id))
        .limit(1)
    )[0];

    if (!content) {
      res.status(500).json({ ok: false, message: "Site email settings were not found for this order's school." });
      return;
    }

    if (content.emailEnabled !== "true") {
      res.status(409).json({ ok: false, message: "Emails are disabled in Email Settings." });
      return;
    }

    if (!content.emailFromAddress) {
      res.status(409).json({ ok: false, message: "Email From Address is not configured." });
      return;
    }

    const orderUrl = `${PUBLIC_SITE_URL}/order/${order.id}`;
    const vars = buildVars({ content, order, orderUrl });
    const subject = applyVars(content.emailSubject, vars);
    const html = renderEmailHtml({ content, order, items, orderUrl });
    const fromName = content.emailFromName || content.brandName || "Store";

    const result = await sendEmail({
      from: `${fromName} <${content.emailFromAddress}>`,
      to: order.customerEmail,
      replyTo: content.emailReplyTo || undefined,
      subject,
      html,
    });

    logger.info({ orderId: order.id, emailId: result.id }, "order confirmation email resent");
    res.json({ ok: true, message: `Email resent to ${order.customerEmail}`, emailId: result.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err, orderId: req.params.id }, "failed to resend order confirmation email");
    res.status(500).json({ ok: false, message });
  }
});

export default router;
