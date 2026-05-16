import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, productsTable } from "@workspace/db";
import type { OrderRow, OrderItemRow } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

type ProductStock = { id: number; stock: number };

type Snapshot = {
  orders: OrderRow[];
  orderItems: OrderItemRow[];
  productStocks: ProductStock[];
  expiresAt: number;
};

let activeSession: Snapshot | null = null;

const DURATION_MS = 10 * 60 * 1000;

const router: IRouter = Router();

router.get("/dev-testing/status", (_req, res) => {
  if (!activeSession || Date.now() > activeSession.expiresAt) {
    activeSession = null;
    res.json({ active: false, expiresAt: null });
    return;
  }
  res.json({ active: true, expiresAt: new Date(activeSession.expiresAt).toISOString() });
});

router.post("/dev-testing/start", async (_req, res): Promise<void> => {
  if (activeSession && Date.now() < activeSession.expiresAt) {
    res.status(400).json({ error: "A testing session is already active" });
    return;
  }

  const orders = await db.select().from(ordersTable);
  const orderItems = await db.select().from(orderItemsTable);
  const productStocks = await db
    .select({ id: productsTable.id, stock: productsTable.stock })
    .from(productsTable);

  activeSession = {
    orders,
    orderItems,
    productStocks,
    expiresAt: Date.now() + DURATION_MS,
  };

  res.json({ active: true, expiresAt: new Date(activeSession.expiresAt).toISOString() });
});

router.post("/dev-testing/stop", async (_req, res): Promise<void> => {
  if (!activeSession) {
    res.status(400).json({ error: "No active testing session" });
    return;
  }

  const snapshot = activeSession;
  activeSession = null;

  await db.transaction(async (tx) => {
    await tx.delete(ordersTable);

    if (snapshot.orders.length > 0) {
      await tx.insert(ordersTable).values(snapshot.orders);
    }
    if (snapshot.orderItems.length > 0) {
      await tx.insert(orderItemsTable).values(snapshot.orderItems);
    }

    await tx.execute(
      sql`SELECT setval('orders_id_seq', COALESCE((SELECT MAX(id) FROM orders), 0))`,
    );
    await tx.execute(
      sql`SELECT setval('order_items_id_seq', COALESCE((SELECT MAX(id) FROM order_items), 0))`,
    );

    for (const p of snapshot.productStocks) {
      await tx
        .update(productsTable)
        .set({ stock: p.stock })
        .where(eq(productsTable.id, p.id));
    }
  });

  res.json({ restored: true, orderCount: snapshot.orders.length });
});

export default router;
