import { Router, type IRouter } from "express";
import { SendTestEmailBody, SendTestEmailResponse } from "@workspace/api-zod";
import { getOrCreateContent } from "./content";
import { renderEmailHtml, sendEmail, applyVars, buildVars } from "../lib/email";
import { logger } from "../lib/logger";
import type { OrderRow, OrderItemRow } from "@workspace/db";

const router: IRouter = Router();

router.post("/email/test", async (req, res): Promise<void> => {
  const body = SendTestEmailBody.parse(req.body);
  const content = await getOrCreateContent();
  const zohoConfigured = Boolean(
    process.env.ZOHO_MAIL_REFRESH_TOKEN &&
    process.env.ZOHO_CLIENT_ID &&
    process.env.ZOHO_CLIENT_SECRET &&
    process.env.ZOHO_MAIL_ACCOUNT_ID,
  );
  if (!zohoConfigured) {
    res.json(SendTestEmailResponse.parse({
      ok: false,
      message: "Zoho Mail credentials are not fully configured on the server.",
    }));
    return;
  }

  const sampleOrder: OrderRow = {
    id: 9999,
    school: content.school,
    customerName: "Sample Customer",
    customerEmail: body.to,
    customerPhone: "555-0100",
    shippingAddress: content.defaultShippingAddress || "123 Sample St",
    city: content.defaultShippingCity || "Sampletown",
    postalCode: content.defaultShippingPostalCode || "00000",
    country: content.defaultShippingCountry || "USA",
    classroom: "Room 101",
    useDefaultAddress: content.defaultShippingAddress ? "true" : "false",
    notes: null,
    customFields: "{}",
    orderType: "sale",
    paymentStatus: "due",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    referrer: null,
    landingPage: null,
    paymentMethod: "cash_on_delivery",
    status: "pending",
    subtotalCents: 1499,
    shippingCents: 0,
    totalCents: 1499,
    currency: "USD",
    createdAt: new Date(),
  };
  const sampleItems: OrderItemRow[] = [{
    id: 1,
    orderId: 9999,
    productId: 1,
    productName: "The Terror Of The Evil Capybara",
    quantity: 1,
    unitPriceCents: 1499,
  }];
  const orderUrl = `https://click.afeonbooks.com/cloudflare/order/${sampleOrder.id}`;
  const vars = buildVars({ content, order: sampleOrder, orderUrl });
  const subject = `[TEST] ${applyVars(content.emailSubject, vars)}`;
  const html = renderEmailHtml({ content, order: sampleOrder, items: sampleItems, orderUrl });

  try {
    const result = await sendEmail({
      from: `AFEON Books <noreply@afeonbooks.com>`,
      to: body.to,
      replyTo: content.emailReplyTo || "aiden.chen@afeonbooks.com",
      subject,
      html,
    });
    res.json(SendTestEmailResponse.parse({
      ok: true,
      emailId: result.id,
      message: `Test email sent to ${body.to}`,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Zoho Mail test email failed");
    res.json(SendTestEmailResponse.parse({ ok: false, message: msg }));
  }
});

// Diagnostic only: validates the configured Zoho Mail OAuth credentials and account.
router.post("/email/zoho-diagnostic", async (req, res): Promise<void> => {
  try {
    const { pin } = (req.body ?? {}) as { pin?: unknown };
    if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
      res.status(400).json({ ok: false, message: "A valid 4-digit admin PIN is required." });
      return;
    }
    const content = await getOrCreateContent();
    if (content.adminPin !== pin) {
      res.status(403).json({ ok: false, message: "Invalid admin PIN." });
      return;
    }

    const configured = Boolean(
      process.env.ZOHO_MAIL_REFRESH_TOKEN &&
      process.env.ZOHO_CLIENT_ID &&
      process.env.ZOHO_CLIENT_SECRET &&
      process.env.ZOHO_MAIL_ACCOUNT_ID,
    );
    if (!configured) {
      res.status(503).json({ ok: false, message: "Zoho Mail credentials are not fully configured on the server." });
      return;
    }

    // A harmless access-token refresh validates OAuth without sending a message.
    // sendEmail is intentionally not called here.
    const response = await fetch(
      `${process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com"}/oauth/v2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: process.env.ZOHO_MAIL_REFRESH_TOKEN!,
          client_id: process.env.ZOHO_CLIENT_ID!,
          client_secret: process.env.ZOHO_CLIENT_SECRET!,
          grant_type: "refresh_token",
        }),
      },
    );
    const text = await response.text();
    let body: Record<string, unknown> = {};
    try { body = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch {}

    res.status(200).json({
      ok: response.ok && typeof body.access_token === "string",
      zohoStatus: response.status,
      authenticatedUser: process.env.ZOHO_MAIL_AUTHENTICATED_USER || "aiden.chen@afeonbooks.com",
      fromAddress: process.env.ZOHO_MAIL_FROM_ADDRESS || "noreply@afeonbooks.com",
      accountIdConfigured: true,
      tokenRefreshSucceeded: response.ok && typeof body.access_token === "string",
      error: typeof body.error === "string" ? body.error : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Zoho Mail diagnostic failed");
    res.status(500).json({ ok: false, message });
  }
});

export default router;
