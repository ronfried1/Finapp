import fs from "node:fs";
import path from "node:path";

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    if (!key) continue;
    if (process.env[key] !== undefined) continue;

    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

const cwd = process.cwd();
loadDotEnv(path.join(cwd, ".env"));
loadDotEnv(path.join(cwd, ".env.local"));

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
