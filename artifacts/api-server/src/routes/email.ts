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
  if (!process.env.MAILERSEND_API_KEY) {
    res.json(
      SendTestEmailResponse.parse({
        ok: false,
        message: "MAILERSEND_API_KEY is not configured on the server.",
      }),
    );
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
  const sampleItems: OrderItemRow[] = [
    {
      id: 1,
      orderId: 9999,
      productId: 1,
      productName: "The Terror Of The Evil Capybara",
      quantity: 1,
      unitPriceCents: 1499,
    },
  ];
  const orderUrl = `${req.protocol}://${req.get("host")}/order/${sampleOrder.id}`;
  const vars = buildVars({ content, order: sampleOrder, orderUrl });
  const subject = `[TEST] ${applyVars(content.emailSubject, vars)}`;
  const html = renderEmailHtml({ content, order: sampleOrder, items: sampleItems, orderUrl });

  const fromName = content.emailFromName || content.brandName || "Store";
  const fromAddress = content.emailFromAddress || "onboarding@resend.dev";
  try {
    const result = await sendEmail({
      from: `${fromName} <${fromAddress}>`,
      to: body.to,
      replyTo: content.emailReplyTo || undefined,
      subject,
      html,
    });
    res.json(
      SendTestEmailResponse.parse({
        ok: true,
        emailId: result.id,
        message: `Test email sent to ${body.to}`,
      }),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "test email failed");
    res.json(SendTestEmailResponse.parse({ ok: false, message: msg }));
  }
});

export default router;
