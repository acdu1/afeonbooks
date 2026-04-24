import { Router, type IRouter } from "express";
import { db, preordersTable, type PreorderRow } from "@workspace/db";
import {
  CreatePreorderBody,
  ListPreordersResponse,
  GetPreordersSummaryResponse,
} from "@workspace/api-zod";
import { desc, sql } from "drizzle-orm";

const router: IRouter = Router();

function serialize(row: PreorderRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    quantity: row.quantity,
    message: row.message ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/preorders", async (_req, res) => {
  const rows = await db
    .select()
    .from(preordersTable)
    .orderBy(desc(preordersTable.createdAt))
    .limit(100);
  res.json(ListPreordersResponse.parse(rows.map(serialize)));
});

router.post("/preorders", async (req, res) => {
  const body = CreatePreorderBody.parse(req.body);
  const inserted = await db
    .insert(preordersTable)
    .values({
      name: body.name,
      email: body.email,
      quantity: body.quantity,
      message: body.message ?? null,
    })
    .returning();
  res.status(201).json(serialize(inserted[0]!));
});

router.get("/preorders/summary", async (_req, res) => {
  const result = await db
    .select({
      totalOrders: sql<number>`cast(count(*) as int)`,
      totalCopies: sql<number>`coalesce(cast(sum(${preordersTable.quantity}) as int), 0)`,
      latestOrderAt: sql<Date | string | null>`max(${preordersTable.createdAt})`,
    })
    .from(preordersTable);
  const r = result[0]!;
  res.json(
    GetPreordersSummaryResponse.parse({
      totalOrders: r.totalOrders,
      totalCopies: r.totalCopies,
      latestOrderAt: r.latestOrderAt
        ? new Date(r.latestOrderAt as string | Date).toISOString()
        : undefined,
    }),
  );
});

export default router;
