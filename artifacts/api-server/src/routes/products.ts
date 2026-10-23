import { Router, type IRouter } from "express";
import { db, productsTable, type ProductRow } from "@workspace/db";
import {
  CreateProductBody,
  ReorderProductsBody,
  UpdateProductBody,
  GetProductParams,
  GetProductResponse,
  ListProductsResponse,
} from "@workspace/api-zod";
import { asc, desc, eq, max } from "drizzle-orm";
import { requireRole, requireUser } from "../lib/auth";

const router: IRouter = Router();

function serialize(p: ProductRow) {
  return {
    id: p.id,
    school: p.school,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    currency: p.currency,
    imageUrl: p.imageUrl,
    stock: p.stock,
    active: p.active,
    showInShop: p.showInShop,
    sortOrder: p.sortOrder,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/products", async (_req, res) => {
  const rows = await db
    .select()
    .from(productsTable)
    .orderBy(asc(productsTable.sortOrder), desc(productsTable.createdAt));
  res.json(ListProductsResponse.parse(rows.map(serialize)));
});

router.put("/products/reorder", requireUser, requireRole("staff", "admin"), async (req, res) => {
  const { productIds } = ReorderProductsBody.parse(req.body);

  if (new Set(productIds).size !== productIds.length) {
    res.status(400).json({ error: "Product IDs must be unique." });
    return;
  }

  const reordered = await db.transaction(async (tx) => {
    const currentProducts = await tx.select({ id: productsTable.id }).from(productsTable);
    if (
      currentProducts.length !== productIds.length ||
      currentProducts.some(({ id }) => !productIds.includes(id))
    ) {
      return false;
    }

    for (const [sortOrder, id] of productIds.entries()) {
      await tx.update(productsTable).set({ sortOrder }).where(eq(productsTable.id, id));
    }
    return true;
  });

  if (!reordered) {
    res.status(400).json({ error: "The product list changed. Refresh and try again." });
    return;
  }
  res.json({ success: true });
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const { id } = GetProductParams.parse(req.params);
  const rows = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!rows[0]) { res.status(404).json({ error: "not found" }); return; }
  res.json(GetProductResponse.parse(serialize(rows[0])));
});

router.post("/products", requireUser, requireRole("staff", "admin"), async (req, res) => {
  const body = CreateProductBody.parse(req.body);
  const [highestOrder] = await db
    .select({ value: max(productsTable.sortOrder) })
    .from(productsTable);
  const inserted = await db
    .insert(productsTable)
    .values({
      ...body,
      school: "alvarado",
      sortOrder: (highestOrder?.value ?? -1) + 1,
    })
    .returning();
  res.status(201).json(GetProductResponse.parse(serialize(inserted[0]!)));
});

router.put("/products/:id", requireUser, requireRole("staff", "admin"), async (req, res): Promise<void> => {
  const { id } = GetProductParams.parse(req.params);
  const body = UpdateProductBody.parse(req.body);
  const updated = await db
    .update(productsTable)
    .set(body)
    .where(eq(productsTable.id, id))
    .returning();
  if (!updated[0]) { res.status(404).json({ error: "not found" }); return; }
  res.json(GetProductResponse.parse(serialize(updated[0])));
});

router.delete("/products/:id", requireUser, requireRole("admin"), async (req, res): Promise<void> => {
  const { id } = GetProductParams.parse(req.params);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.status(204).end();
});

export default router;
