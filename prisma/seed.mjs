import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaultCategories = [
  ["Housing", "#4f46e5"],
  ["Groceries", "#16a34a"],
  ["Dining", "#ea580c"],
  ["Transport", "#0284c7"],
  ["Utilities", "#9333ea"],
  ["Health", "#db2777"],
  ["Shopping", "#0f766e"],
  ["Entertainment", "#ca8a04"],
  ["Income", "#15803d"],
  ["Other", "#6b7280"]
];

async function main() {
  const user = await prisma.user.findFirst({ where: { email: { not: null } } });
  if (!user) {
    return;
  }

  for (const [name, color] of defaultCategories) {
    await prisma.category.upsert({
      where: { userId_name: { userId: user.id, name } },
      update: {},
      create: {
        userId: user.id,
        name,
        color,
        isSystem: true
      }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
