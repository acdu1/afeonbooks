import fs from "fs/promises";
import path from "path";

const repoRoot = path.resolve(process.cwd(), "..", "..");
const targetArg = process.argv[2];
if (!targetArg) {
  console.error("Usage: node scripts/export_source.mjs <target-dir>");
  process.exit(1);
}

const target = path.resolve(process.cwd(), targetArg);
const targetRel = path.relative(repoRoot, target).replace(/\\/g, "/");

const excludeNames = new Set([".git", "node_modules", ".cache"]);
const excludePrefixes = [
  "dist/",
  "artifacts/" + path.sep + "*" + path.sep + "dist/public/source",
  "artifacts/" + path.sep + "*" + path.sep + "dist/public/assets",
].map((prefix) => prefix.replace(/\\/g, "/"));

function normalizeRel(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function shouldExclude(filePath) {
  const rel = normalizeRel(filePath);
  if (!rel || rel === ".") return false;
  if (rel === targetRel || rel.startsWith(`${targetRel}/`)) return true;
  if (excludeNames.has(path.basename(filePath))) return true;
  if (rel.startsWith("dist/") || rel.startsWith("artifacts/") || rel.startsWith("public/source")) return true;
  if (rel.startsWith(".replit-artifact") || rel.startsWith("artifacts/")) {
    if (rel.includes("dist/public/source") || rel.includes("dist/public/assets") || rel.includes("dist/")) return true;
  }
  return false;
}

async function copyDirectory(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(src, entry.name);
      if (shouldExclude(srcPath)) return;

      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await copyDirectory(srcPath, destPath);
      } else if (entry.isSymbolicLink()) {
        const linkTarget = await fs.readlink(srcPath);
        await fs.symlink(linkTarget, destPath);
      } else if (entry.isFile()) {
        await fs.copyFile(srcPath, destPath);
      }
    })
  );
}

async function main() {
  await fs.rm(target, { recursive: true, force: true });
  await copyDirectory(repoRoot, target);
  console.log(`Exported source to ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
