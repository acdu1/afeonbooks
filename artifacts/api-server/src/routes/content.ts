import { Router, type IRouter } from "express";
import { db, siteContentTable, type SiteContentRow } from "@workspace/db";
import { UpdateContentBody, GetContentResponse } from "@workspace/api-zod";
import { asc, eq } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULT_CONTENT = {
  brandName: "Totec Books",
  navHomeLabel: "Home",
  heroTitle: "The Terror Of The Evil Capybara",
  heroSubtitle: "Preorder your book now.",
  ctaLabel: "Learn More",
  ctaUrl: "#preorder",
  coverImageUrl:
    "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=900&q=80",
  aboutHeading: "Book One in an Epic Watercolor Saga",
  aboutBody:
    "When a giant capybara descends on the kingdom, only an unlikely band of friends can stand against the chaos. Hand-painted, hand-written, and bursting with imagination, this is a storybook for kids who dream in color.",
  authorsLine: "Written by Francis Kamberis, Naomi Tsao, Olivia Cheng, Evan Lee.",
  illustratorLine: "Illustrated by Janis Vong.",
  footerNote: "(c) Totec Books. All rights reserved.",
  accentColor: "#E2553B",
};

function serialize(row: SiteContentRow) {
  return {
    id: row.id,
    brandName: row.brandName,
    navHomeLabel: row.navHomeLabel,
    heroTitle: row.heroTitle,
    heroSubtitle: row.heroSubtitle,
    ctaLabel: row.ctaLabel,
    ctaUrl: row.ctaUrl,
    coverImageUrl: row.coverImageUrl,
    aboutHeading: row.aboutHeading,
    aboutBody: row.aboutBody,
    authorsLine: row.authorsLine,
    illustratorLine: row.illustratorLine,
    footerNote: row.footerNote,
    accentColor: row.accentColor,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOrCreate(): Promise<SiteContentRow> {
  const existing = await db
    .select()
    .from(siteContentTable)
    .orderBy(asc(siteContentTable.id))
    .limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db
    .insert(siteContentTable)
    .values(DEFAULT_CONTENT)
    .returning();
  return inserted[0]!;
}

router.get("/content", async (_req, res) => {
  const row = await getOrCreate();
  res.json(GetContentResponse.parse(serialize(row)));
});

router.put("/content", async (req, res) => {
  const body = UpdateContentBody.parse(req.body);
  const current = await getOrCreate();
  const updated = await db
    .update(siteContentTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(siteContentTable.id, current.id))
    .returning();
  res.json(GetContentResponse.parse(serialize(updated[0]!)));
});

export default router;
