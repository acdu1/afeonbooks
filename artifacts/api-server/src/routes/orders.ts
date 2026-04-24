import { Router, type IRouter } from "express";
import {
  db,
  ordersTable,
  orderItemsTable,
  productsTable,
  type OrderRow,
  type OrderItemRow,
} from "@workspace/db";
import {
  CreateOrderBody,
  GetOrderParams,
  GetOrderResponse,
  ListOrdersResponse,
  GetOrdersSummaryResponse,
} from "@workspace/api-zod";
import { desc, eq, inArray, sql } from "drizzle-orm";

const router: IRouter = Router();

function serializeOrder(o: OrderRow, items: OrderItemRow[]) {
  return {
    id: o.id,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    shippingAddress: o.shippingAddress,
    city: o.city,
    postalCode: o.postalCode,
    country: o.country,
    notes: o.notes ?? undefined,
    paymentMethod: o.paymentMethod,
    status: o.status,
    subtotalCents: o.subtotalCents,
    shippingCents: o.shippingCents,
    totalCents: o.totalCents,
    currency: o.currency,
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

router.get("/orders", async (_req, res) => {
  const orders = await db
    .select()
    .from(ordersTable)
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

router.get("/orders/summary", async (_req, res) => {
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
  if (!found[0]) res.status(404).json({ error: "not found" }); return;
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, id));
  res.json(GetOrderResponse.parse(serializeOrder(found[0], items)));
});

router.post("/orders", async (req, res): Promise<void> => {
  const body = CreateOrderBody.parse(req.body);
  const productIds = body.items.map((i) => i.productId);
  const products = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));
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
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone,
        shippingAddress: body.shippingAddress,
        city: body.city,
        postalCode: body.postalCode,
        country: body.country,
        notes: body.notes ?? null,
        paymentMethod: "cash_on_delivery",
        status: "pending",
        subtotalCents: subtotal,
        shippingCents: shipping,
        totalCents: total,
        currency,
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

  res.status(201).json(GetOrderResponse.parse(serializeOrder(created.order, created.items)));
});

export default router;
