import { Router, type IRouter } from "express";
import { db, productsTable, type ProductRow } from "@workspace/db";
import {
  CreateProductBody,
  UpdateProductBody,
  GetProductParams,
  GetProductResponse,
  ListProductsResponse,
} from "@workspace/api-zod";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

function serialize(p: ProductRow) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    currency: p.currency,
    imageUrl: p.imageUrl,
    stock: p.stock,
    active: p.active,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/products", async (_req, res) => {
  const rows = await db.select().from(productsTable).orderBy(desc(productsTable.createdAt));
  res.json(ListProductsResponse.parse(rows.map(serialize)));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const { id } = GetProductParams.parse(req.params);
  const rows = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!rows[0]) { res.status(404).json({ error: "not found" }); return; }
  res.json(GetProductResponse.parse(serialize(rows[0])));
});

router.post("/products", async (req, res) => {
  const body = CreateProductBody.parse(req.body);
  const inserted = await db.insert(productsTable).values(body).returning();
  res.status(201).json(GetProductResponse.parse(serialize(inserted[0]!)));
});

router.put("/products/:id", async (req, res): Promise<void> => {
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

router.delete("/products/:id", async (req, res): Promise<void> => {
  const { id } = GetProductParams.parse(req.params);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.status(204).end();
});

export default router;
