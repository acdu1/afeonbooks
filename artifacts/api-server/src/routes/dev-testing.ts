import { Router, type IRouter } from "express";
import { db, ordersTable, orderItemsTable, productsTable } from "@workspace/db";
import type { OrderRow, OrderItemRow } from "@workspace/db";

import type { ProductRow } from "@workspace/db";

type Snapshot = {
  orders: OrderRow[];
  orderItems: OrderItemRow[];
  products: ProductRow[];
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
  const products = await db.select().from(productsTable);

  activeSession = {
    orders,
    orderItems,
    products,
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

  try {
    await db.transaction(async (tx) => {
      // Remove child rows first so foreign keys from order_items -> orders
      // cannot block the restore.
      await tx.delete(orderItemsTable);
      await tx.delete(ordersTable);
      await tx.delete(productsTable);

      // Restore parents before children.
      if (snapshot.orders.length > 0) {
        await tx.insert(ordersTable).values(snapshot.orders);
      }
      if (snapshot.products.length > 0) {
        await tx.insert(productsTable).values(snapshot.products);
      }
      if (snapshot.orderItems.length > 0) {
        await tx.insert(orderItemsTable).values(snapshot.orderItems);
      }
    });

    // Keep the session until the database transaction has succeeded.
    activeSession = null;
    res.json({ restored: true, orderCount: snapshot.orders.length });
  } catch (error) {
    console.error("Dev testing restore failed:", error);
    res.status(500).json({ error: "Failed to restore the testing snapshot" });
  }
});

export default router;
