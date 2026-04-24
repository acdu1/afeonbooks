import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const preordersTable = pgTable("preorders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  quantity: integer("quantity").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PreorderRow = typeof preordersTable.$inferSelect;
