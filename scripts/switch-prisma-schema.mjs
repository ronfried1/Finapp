import fs from "node:fs";
import path from "node:path";

const providerInput = (process.env.APP_DB_PROVIDER ?? "postgresql").toLowerCase();
const normalizedProvider = providerInput === "postgres" ? "postgresql" : providerInput;

const allowed = new Set(["postgresql", "sqlite"]);
if (!allowed.has(normalizedProvider)) {
  console.error(
    `[db] Invalid APP_DB_PROVIDER="${providerInput}". Use one of: ${[...allowed].join(", ")}.`
  );
  process.exit(1);
}

const prismaDir = path.resolve(process.cwd(), "prisma");
const source = path.join(prismaDir, `schema.${normalizedProvider}.prisma`);
const target = path.join(prismaDir, "schema.prisma");

if (!fs.existsSync(source)) {
  console.error(`[db] Missing schema template: ${source}`);
  process.exit(1);
}

const content = fs.readFileSync(source, "utf8");
fs.writeFileSync(target, content, "utf8");

console.log(`[db] Prisma schema switched to ${normalizedProvider} -> prisma/schema.prisma`);
