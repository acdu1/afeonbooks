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
      ADD COLUMN IF NOT EXISTS school text NOT NULL DEFAULT 'alvarado',
      ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'sale',
      ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'due',
      ADD COLUMN IF NOT EXISTS estimated_delivery_date text
  `);
  logger.info("Verified orders.order_type and orders.payment_status columns");
}

async function ensureContentColumns() {
  await pool.query(`
    ALTER TABLE site_content
      ADD COLUMN IF NOT EXISTS school text NOT NULL DEFAULT 'alvarado',
      ADD COLUMN IF NOT EXISTS admin_pin text NOT NULL DEFAULT '2026',
      ADD COLUMN IF NOT EXISTS orders_enabled text NOT NULL DEFAULT 'true',
      ADD COLUMN IF NOT EXISTS maintenance_mode text NOT NULL DEFAULT 'false',
      ADD COLUMN IF NOT EXISTS checkout_fields text NOT NULL DEFAULT '[]'
  `);
  logger.info("Verified site_content compatibility columns");
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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
    UPDATE users SET email_verified_at = now() WHERE email_verified_at IS NULL;
    CREATE TABLE IF NOT EXISTS sessions (
      id serial PRIMARY KEY,
      token_hash text NOT NULL UNIQUE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions(token_hash);
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE,
      type text NOT NULL,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS auth_tokens_user_type_idx ON auth_tokens(user_id, type);
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id integer,
      points integer NOT NULL,
      description text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS loyalty_transactions_user_id_idx ON loyalty_transactions(user_id);
  `);
  logger.info("Verified auth tables");
}

async function ensureAuthenticatorTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS authenticator_accounts (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name text NOT NULL,
      encrypted_secret text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS authenticator_accounts_user_id_idx ON authenticator_accounts(user_id);
  `);
  logger.info("Verified authenticator accounts table");
}

await ensureOrderColumns();
await ensureContentColumns();
await ensureAuthTables();
await ensureAuthenticatorTable();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
