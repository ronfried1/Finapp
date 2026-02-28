import { prisma } from "@/lib/db";
import { normalizeMerchant } from "@/lib/format";

const systemCategoryPairs = [
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
] as const;

export async function ensureDefaultCategories(userId: string) {
  for (const [name, color] of systemCategoryPairs) {
    await prisma.category.upsert({
      where: { userId_name: { userId, name } },
      update: {},
      create: { userId, name, color, isSystem: true }
    });
  }
}

export async function pickCategoryId(userId: string, sourceCategory: string | undefined, merchant: string): Promise<string> {
  const normalizedMerchant = normalizeMerchant(merchant);
  const byRule = await prisma.merchantRule.findUnique({
    where: {
      userId_merchantNormalized: {
        userId,
        merchantNormalized: normalizedMerchant
      }
    }
  });

  if (byRule) {
    return byRule.categoryId;
  }

  const requestedName = sourceCategory?.trim();
  if (requestedName) {
    const categories = await prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true }
    });
    const match = categories.find((category) => category.name.toLowerCase() === requestedName.toLowerCase());
    if (match) {
      return match.id;
    }
  }

  const fallback = await prisma.category.findUnique({
    where: { userId_name: { userId, name: "Other" } }
  });

  if (!fallback) {
    await ensureDefaultCategories(userId);
    const afterSeed = await prisma.category.findUniqueOrThrow({
      where: { userId_name: { userId, name: "Other" } }
    });
    return afterSeed.id;
  }

  return fallback.id;
}
