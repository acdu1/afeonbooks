import { Router, type IRouter } from "express";
import {
  db,
  ordersTable,
  orderItemsTable,
  productsTable,
  siteContentTable,
  usersTable,
  loyaltyTransactionsTable,
  type OrderRow,
  type OrderItemRow,
} from "@workspace/db";
import {
  CreateOrderBody,
  GetOrderParams,
  GetOrderResponse,
  ListOrdersResponse,
  GetOrdersSummaryResponse,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
  UpdateOrderStatusResponse,
  DeleteOrderParams,
} from "@workspace/api-zod";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { sendOrderConfirmation } from "../lib/email";
import { requireRole, requireUser } from "../lib/auth";

const router: IRouter = Router();

function serializeOrder(o: OrderRow, items: OrderItemRow[]) {
  return {
    id: o.id,
    school: o.school,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    shippingAddress: o.shippingAddress,
    city: o.city,
    postalCode: o.postalCode,
    country: o.country,
    classroom: o.classroom ?? undefined,
    useDefaultAddress: o.useDefaultAddress === "true",
    notes: o.notes ?? undefined,
    customFields: JSON.parse(o.customFields || "{}"),
    paymentMethod: o.paymentMethod,
    orderType: o.orderType,
    paymentStatus: o.paymentStatus,
    status: o.status,
    subtotalCents: o.subtotalCents,
    shippingCents: o.shippingCents,
    totalCents: o.totalCents,
    currency: o.currency,
    utmSource: o.utmSource ?? undefined,
    utmMedium: o.utmMedium ?? undefined,
    utmCampaign: o.utmCampaign ?? undefined,
    utmTerm: o.utmTerm ?? undefined,
    utmContent: o.utmContent ?? undefined,
    referrer: o.referrer ?? undefined,
    landingPage: o.landingPage ?? undefined,
    createdAt: o.createdAt.toISOString(),
    items: items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
    })),
  };
}

router.get("/orders", requireUser, requireRole("staff", "admin"), async (req, res) => {
  const school = req.query.school === "shelyn" ? "shelyn" : "alvarado";
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.school, school))
    .orderBy(desc(ordersTable.createdAt))
    .limit(200);
  if (orders.length === 0) {
    res.json([]);
    return;
  }
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(
      inArray(
        orderItemsTable.orderId,
        orders.map((o) => o.id),
      ),
    );
  const byOrder = new Map<number, OrderItemRow[]>();
  for (const it of items) {
    const arr = byOrder.get(it.orderId) ?? [];
    arr.push(it);
    byOrder.set(it.orderId, arr);
  }
  res.json(
    ListOrdersResponse.parse(
      orders.map((o) => serializeOrder(o, byOrder.get(o.id) ?? [])),
    ),
  );
});

router.get("/orders/mine", requireUser, async (req, res) => {
  const email = req.user!.email.toLowerCase();
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.customerEmail, email))
    .orderBy(desc(ordersTable.createdAt));

  if (orders.length === 0) {
    res.json([]);
    return;
  }

  const items = await db
    .select()
    .from(orderItemsTable)
    .where(
      inArray(
        orderItemsTable.orderId,
        orders.map((o) => o.id),
      ),
    );

  const byOrder = new Map<number, OrderItemRow[]>();
  for (const it of items) {
    const arr = byOrder.get(it.orderId) ?? [];
    arr.push(it);
    byOrder.set(it.orderId, arr);
  }

  res.json(
    orders.map((o) => serializeOrder(o, byOrder.get(o.id) ?? [])),
  );
});

router.get("/orders/summary", requireUser, requireRole("staff", "admin"), async (_req, res) => {
  const r = (
    await db
      .select({
        totalOrders: sql<number>`cast(count(*) as int)`,
        pendingOrders: sql<number>`cast(count(*) filter (where ${ordersTable.status} = 'pending') as int)`,
        revenueCents: sql<number>`coalesce(cast(sum(${ordersTable.totalCents}) as int), 0)`,
        currency: sql<string | null>`max(${ordersTable.currency})`,
      })
      .from(ordersTable)
  )[0]!;
  res.json(
    GetOrdersSummaryResponse.parse({
      totalOrders: r.totalOrders,
      pendingOrders: r.pendingOrders,
      revenueCents: r.revenueCents,
      currency: r.currency ?? "USD",
    }),
  );
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const { id } = GetOrderParams.parse(req.params);
  const found = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!found[0]) {
    res.status(404).json({ error: "not found" });
    return;
  }

  if (req.user) {
    const isStaffOrAdmin = req.user.role === "staff" || req.user.role === "admin";
    const isOwner = found[0].customerEmail.toLowerCase() === req.user.email.toLowerCase();
    if (!isStaffOrAdmin && !isOwner) {
      res.status(403).json({ error: "Not allowed" });
      return;
    }
  }

  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, id));
  res.json(GetOrderResponse.parse(serializeOrder(found[0], items)));
});

router.post("/orders", async (req, res): Promise<void> => {
  const body = CreateOrderBody.parse(req.body);
  const school = body.school;

  let shippingAddress: string;
  let city: string;
  let postalCode: string;
  let country: string;
  let classroom: string | null = null;

  if (body.useDefaultAddress) {
    const content = (
      await db
        .select()
        .from(siteContentTable)
        .where(eq(siteContentTable.school, school))
        .orderBy(asc(siteContentTable.id))
        .limit(1)
    )[0];
    if (
      !content ||
      !content.defaultShippingAddress ||
      !content.defaultShippingCity ||
      !content.defaultShippingPostalCode ||
      !content.defaultShippingCountry
    ) {
      res.status(400).json({
        error:
          "Default shipping address is not configured. Please ask the admin to set it up.",
      });
      return;
    }
    const trimmedClassroom = (body.classroom ?? "").trim();
    if (!trimmedClassroom) {
      res.status(400).json({ error: "Classroom number is required." });
      return;
    }
    shippingAddress = content.defaultShippingAddress;
    city = content.defaultShippingCity;
    postalCode = content.defaultShippingPostalCode;
    country = content.defaultShippingCountry;
    classroom = trimmedClassroom;
  } else {
    const sa = (body.shippingAddress ?? "").trim();
    const ci = (body.city ?? "").trim();
    const pc = (body.postalCode ?? "").trim();
    const co = (body.country ?? "").trim();
    if (!sa || !ci || !pc || !co) {
      res.status(400).json({
        error:
          "Shipping address, city, postal code, and country are required for custom addresses.",
      });
      return;
    }
    shippingAddress = sa;
    city = ci;
    postalCode = pc;
    country = co;
  }

  const productIds = body.items.map((i) => i.productId);
  const products = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.school, school), inArray(productsTable.id, productIds)));
  const byId = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  const lineItems: { productId: number; productName: string; quantity: number; unitPriceCents: number }[] = [];
  for (const it of body.items) {
    const p = byId.get(it.productId);
    if (!p) {
      res.status(400).json({ error: `Unknown product ${it.productId}` });
      return;
    }
    if (!p.active) {
      res.status(400).json({ error: `Product ${p.name} is not available` });
      return;
    }
    if (p.stock < it.quantity) {
      res.status(400).json({ error: `Not enough stock for ${p.name}` });
      return;
    }
    subtotal += p.priceCents * it.quantity;
    lineItems.push({
      productId: p.id,
      productName: p.name,
      quantity: it.quantity,
      unitPriceCents: p.priceCents,
    });
  }
  const currency = products[0]?.currency ?? "USD";
  const shipping = 0;
  const total = subtotal + shipping;

  const created = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(ordersTable)
      .values({
        school,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone,
        shippingAddress,
        city,
        postalCode,
        country,
        classroom,
        useDefaultAddress: body.useDefaultAddress ? "true" : "false",
        notes: body.notes ?? null,
        customFields: JSON.stringify(body.customFields ?? {}),
        paymentMethod: "cash_on_delivery",
        orderType: body.orderType === "preorder" ? "preorder" : "sale",
        paymentStatus: body.orderType === "preorder" ? "due_later" : "due",
        status: "pending",
        subtotalCents: subtotal,
        shippingCents: shipping,
        totalCents: total,
        currency,
        utmSource: body.utmSource ?? null,
        utmMedium: body.utmMedium ?? null,
        utmCampaign: body.utmCampaign ?? null,
        utmTerm: body.utmTerm ?? null,
        utmContent: body.utmContent ?? null,
        referrer: body.referrer ?? null,
        landingPage: body.landingPage ?? null,
      })
      .returning();
    const order = inserted[0]!;
    const items = await tx
      .insert(orderItemsTable)
      .values(lineItems.map((li) => ({ ...li, orderId: order.id })))
      .returning();
    for (const it of body.items) {
      await tx
        .update(productsTable)
        .set({ stock: sql`${productsTable.stock} - ${it.quantity}` })
        .where(eq(productsTable.id, it.productId));
    }
    return { order, items };
  });

  const content = (
    await db
      .select()
      .from(siteContentTable)
      .where(eq(siteContentTable.school, school))
      .orderBy(asc(siteContentTable.id))
      .limit(1)
  )[0];
  if (content) {
    const orderUrl = `https://click.afeonbooks.com/orders/${created.order.id}`;
    void sendOrderConfirmation({
      content,
      order: created.order,
      items: created.items,
      orderUrl,
    });
  }

  res.status(201).json(GetOrderResponse.parse(serializeOrder(created.order, created.items)));
});

router.patch("/orders/:id", requireUser, requireRole("staff", "admin"), async (req, res): Promise<void> => {
  const { id } = UpdateOrderStatusParams.parse(req.params);
  const body = UpdateOrderStatusBody.parse(req.body);
  const updated = await db.transaction(async (tx) => {
    const current = await tx.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!current[0]) return [];

    const changed = await tx
      .update(ordersTable)
      .set({ status: body.status })
      .where(eq(ordersTable.id, id))
      .returning();

    if (body.status === "completed" && current[0].status !== "completed") {
      const [user] = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, current[0].customerEmail.toLowerCase()))
        .limit(1);
      if (user) {
        const existing = await tx
          .select({ id: loyaltyTransactionsTable.id })
          .from(loyaltyTransactionsTable)
          .where(eq(loyaltyTransactionsTable.orderId, id))
          .limit(1);
        if (!existing[0]) {
          await tx.insert(loyaltyTransactionsTable).values({
            userId: user.id,
            orderId: id,
            points: Math.floor(current[0].totalCents / 100),
            description: `Points earned from order #${id}`,
          });
        }
      }
    }
    return changed;
  });
  if (!updated[0]) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, id));
  res.json(UpdateOrderStatusResponse.parse(serializeOrder(updated[0], items)));
});

router.delete("/orders/:id", requireUser, requireRole("admin"), async (req, res): Promise<void> => {
  const { id } = DeleteOrderParams.parse(req.params);
  const deleted = await db
    .delete(ordersTable)
    .where(eq(ordersTable.id, id))
    .returning({ id: ordersTable.id });
  if (!deleted[0]) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.status(204).send();
});

export default router;
