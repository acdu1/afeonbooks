import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { authenticatorAccountsTable, db } from "@workspace/db";
import { requireRole, requireUser } from "../lib/auth";

const router: IRouter = Router();
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD_SECONDS = 30;

function encryptionKey(): Buffer | null {
  const value = process.env.TOTP_ENCRYPTION_KEY;
  if (!value) return null;
  const key = Buffer.from(value, "base64");
  return key.length === 32 ? key : null;
}

function parseSecret(input: string): Buffer | null {
  let value = input.trim();
  if (value.startsWith("otpauth://")) {
    try {
      const uri = new URL(value);
      if (uri.protocol !== "otpauth:" || uri.hostname !== "totp") return null;
      value = uri.searchParams.get("secret") ?? "";
    } catch {
      return null;
    }
  }

  const encoded = value.toUpperCase().replace(/[\s=-]/g, "");
  if (!encoded || !/^[A-Z2-7]+$/.test(encoded)) return null;
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const character of encoded) {
    buffer = (buffer << 5) | BASE32.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
      buffer &= (1 << bits) - 1;
    }
  }
  return bytes.length >= 10 ? Buffer.from(bytes) : null;
}

function encryptSecret(secret: Buffer, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64")).join(":");
}

function decryptSecret(encrypted: string, key: Buffer): Buffer {
  const [iv, authTag, ciphertext] = encrypted.split(":").map((part) => Buffer.from(part, "base64"));
  if (!iv || !authTag || !ciphertext || iv.length !== 12 || authTag.length !== 16) throw new Error("Invalid encrypted authenticator secret");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function currentCode(secret: Buffer, now = Date.now()): string {
  const counter = BigInt(Math.floor(now / 1000 / PERIOD_SECONDS));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

router.get("/authenticator", requireUser, requireRole("admin"), async (req, res): Promise<void> => {
  const key = encryptionKey();
  if (!key) {
    res.status(503).json({ error: "Authenticator storage is not configured on the server" });
    return;
  }
  const rows = await db.select().from(authenticatorAccountsTable)
    .where(eq(authenticatorAccountsTable.userId, req.user!.id))
    .orderBy(asc(authenticatorAccountsTable.name));
  const now = Date.now();
  res.json({ accounts: rows.map((account) => ({
    id: account.id,
    name: account.name,
    code: currentCode(decryptSecret(account.encryptedSecret, key), now),
    expiresAt: (Math.floor(now / (PERIOD_SECONDS * 1000)) + 1) * PERIOD_SECONDS * 1000,
  })) });
});

router.post("/authenticator", requireUser, requireRole("admin"), async (req, res): Promise<void> => {
  const key = encryptionKey();
  if (!key) {
    res.status(503).json({ error: "Authenticator storage is not configured on the server" });
    return;
  }
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const secretText = typeof req.body?.secret === "string" ? req.body.secret : "";
  const secret = parseSecret(secretText);
  if (!name || name.length > 80 || !secret || secretText.length > 512) {
    res.status(400).json({ error: "Enter a name and a valid authenticator setup key or otpauth URI" });
    return;
  }
  const [account] = await db.insert(authenticatorAccountsTable).values({
    userId: req.user!.id,
    name,
    encryptedSecret: encryptSecret(secret, key),
  }).returning({ id: authenticatorAccountsTable.id, name: authenticatorAccountsTable.name });
  res.status(201).json({ account });
});

router.delete("/authenticator/:id", requireUser, requireRole("admin"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid account ID" });
    return;
  }
  const deleted = await db.delete(authenticatorAccountsTable)
    .where(and(eq(authenticatorAccountsTable.id, id), eq(authenticatorAccountsTable.userId, req.user!.id)))
    .returning({ id: authenticatorAccountsTable.id });
  if (!deleted[0]) {
    res.status(404).json({ error: "Authenticator account not found" });
    return;
  }
  res.status(204).send();
});

export default router;