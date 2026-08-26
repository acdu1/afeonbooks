import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureOrderColumns() {
  // The production Supabase database was created before these fields existed.
  // Keep startup self-healing so the Drizzle schema matches the live database.
  await pool.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'sale',
      ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'due'
  `);
  logger.info("Verified orders.order_type and orders.payment_status columns");
}

await ensureOrderColumns();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
