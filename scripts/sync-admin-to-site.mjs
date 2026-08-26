import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adminDist = path.join(root, "artifacts", "admin", "dist", "public");
const siteAdmin = path.join(root, "artifacts", "site", "dist", "public", "admin");

await mkdir(path.dirname(siteAdmin), { recursive: true });
await rm(siteAdmin, { recursive: true, force: true });
await cp(adminDist, siteAdmin, { recursive: true });

console.log(`Synced admin build: ${adminDist} -> ${siteAdmin}`);
