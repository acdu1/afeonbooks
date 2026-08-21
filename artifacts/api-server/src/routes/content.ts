import { Router, type IRouter } from "express";
import { db, siteContentTable, type SiteContentRow } from "@workspace/db";
import { UpdateContentBody, GetContentResponse } from "@workspace/api-zod";
import { asc, eq } from "drizzle-orm";

const router: IRouter = Router();

const DEFAULT_CONTENT = {
  brandName: "AFEON Books",
  navHomeLabel: "Home",
  heroTitle: "The Terror Of The Evil Capybara",
  heroSubtitle: "Written by 6th Graders.",
  ctaLabel: "Shop Now",
  ctaUrl: "/shop",
  coverImageUrl:
    "https://static.wixstatic.com/media/91d5eb_b2c9e6441ca74cf0ad33c5b8935b9ffe~mv2.jpg/v1/fill/w_584,h_751,al_c,q_85,usm_0.66_1.00_0.01/91d5eb_b2c9e6441ca74cf0ad33c5b8935b9ffe~mv2.jpg",
  aboutHeading: "The Terror Of The Evil Capybara - Book 1",
  aboutBody:
    "When terror reveals itself to the detectives, it comes in the form of a fury little capybara with glasses. What happens when these two enemies go head to head? Who will win the duel? Good? Or evil? Join the detectives, White Dragon, Evanzilla, Naomi Da Apple and Kevin as they try to win the battle against evil and also do dangerous things while at it, like jumping off skyscrapers.",
  authorsLine: "Francis Kawibawa, Naomi Tsao, Olivia Chang, Evan Lee.",
  illustratorLine: "Janis Vong",
  footerNote: "© 2026 AFR Group. All Rights Reserved.",
  accentColor: "#E2553B",
  defaultShippingLabel: "School Delivery",
  defaultShippingAddress: "",
  defaultShippingCity: "",
  defaultShippingPostalCode: "",
  defaultShippingCountry: "",
  checkoutFields: "[]",
};

const SCHOOL_NAMES = { alvarado: "Alvarado Intermediate", shelyn: "Shelyn Elementary" } as const;
function schoolOf(value: unknown) {
  return value === "shelyn" ? "shelyn" : "alvarado";
}

export function serializeContent(row: SiteContentRow) {
  return {
    id: row.id,
    school: row.school,
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
    defaultShippingLabel: row.defaultShippingLabel,
    defaultShippingAddress: row.defaultShippingAddress,
    defaultShippingCity: row.defaultShippingCity,
    defaultShippingPostalCode: row.defaultShippingPostalCode,
    defaultShippingCountry: row.defaultShippingCountry,
    ordersEnabled: row.ordersEnabled === "true",
    emailEnabled: row.emailEnabled === "true",
    emailFromName: row.emailFromName,
    emailFromAddress: row.emailFromAddress,
    emailReplyTo: row.emailReplyTo,
    emailSubject: row.emailSubject,
    emailHeading: row.emailHeading,
    emailIntro: row.emailIntro,
    emailButtonLabel: row.emailButtonLabel,
    emailFooter: row.emailFooter,
    emailAccentColor: row.emailAccentColor,
    checkoutFields: JSON.parse(row.checkoutFields || "[]"),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getOrCreateContent(school = "alvarado"): Promise<SiteContentRow> {
  const existing = await db
    .select()
    .from(siteContentTable)
    .where(eq(siteContentTable.school, school))
    .orderBy(asc(siteContentTable.id))
    .limit(1);
  if (existing[0]) return existing[0];
  const inserted = await db
    .insert(siteContentTable)
    .values({ ...DEFAULT_CONTENT, school, brandName: `${SCHOOL_NAMES[school as keyof typeof SCHOOL_NAMES] ?? "AFEON Books"} Books` })
    .returning();
  return inserted[0]!;
}

router.get("/content", async (req, res) => {
  const row = await getOrCreateContent(schoolOf(req.query.school));
  res.json(GetContentResponse.parse(serializeContent(row)));
});

router.put("/content", async (req, res) => {
  const body = UpdateContentBody.parse(req.body);
  const current = await getOrCreateContent(schoolOf(req.query.school));
  const { ordersEnabled, emailEnabled, checkoutFields, ...rest } = body;
  const updated = await db
    .update(siteContentTable)
    .set({
      ...rest,
      ordersEnabled: ordersEnabled ? "true" : "false",
      emailEnabled: emailEnabled ? "true" : "false",
      checkoutFields: JSON.stringify(checkoutFields ?? []),
      updatedAt: new Date(),
    })
    .where(eq(siteContentTable.id, current.id))
    .returning();
  res.json(GetContentResponse.parse(serializeContent(updated[0]!)));
});

export default router;
