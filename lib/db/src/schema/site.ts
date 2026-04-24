import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const siteContentTable = pgTable("site_content", {
  id: serial("id").primaryKey(),
  brandName: text("brand_name").notNull(),
  navHomeLabel: text("nav_home_label").notNull(),
  heroTitle: text("hero_title").notNull(),
  heroSubtitle: text("hero_subtitle").notNull(),
  ctaLabel: text("cta_label").notNull(),
  ctaUrl: text("cta_url").notNull(),
  coverImageUrl: text("cover_image_url").notNull(),
  aboutHeading: text("about_heading").notNull(),
  aboutBody: text("about_body").notNull(),
  authorsLine: text("authors_line").notNull(),
  illustratorLine: text("illustrator_line").notNull(),
  footerNote: text("footer_note").notNull(),
  accentColor: text("accent_color").notNull(),
  defaultShippingLabel: text("default_shipping_label").notNull().default(""),
  defaultShippingAddress: text("default_shipping_address").notNull().default(""),
  defaultShippingCity: text("default_shipping_city").notNull().default(""),
  defaultShippingPostalCode: text("default_shipping_postal_code").notNull().default(""),
  defaultShippingCountry: text("default_shipping_country").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SiteContentRow = typeof siteContentTable.$inferSelect;
