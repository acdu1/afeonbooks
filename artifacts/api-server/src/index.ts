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

async function ensureAuthTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id serial PRIMARY KEY,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      name text NOT NULL,
      role text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id serial PRIMARY KEY,
      token_hash text NOT NULL UNIQUE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions(token_hash);
  `);
  logger.info("Verified auth tables");
}

await ensureOrderColumns();
await ensureAuthTables();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
